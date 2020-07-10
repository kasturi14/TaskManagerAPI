const express = require('express');
const router = new express.Router();
const User = require('../models/user');
const auth = require('../middleware/auth');
const multer = require('multer');
const sharp = require('sharp');

// signing up
router.post('/users', async(req, res) => {
    const user = new User(req.body);

    try {
        await user.save();
        const token = await user.generateAuthTokens();
        res.status(201).send({ user, token });
    } catch (e) {
        res.status(400).send(e);
    }
});

// login
router.post('/users/login', async(req, res) => {
    try {
        const user = await User.findByCredentials(req.body.email, req.body.password);
        const token = await user.generateAuthTokens();
        res.send({ user, token });
    } catch (e) {
        res.status(400).send();
    }
});

// logout of a single sessions
router.post('/users/logout', auth, async(req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token != req.token;
        });
        await req.user.save();

        res.send();
    } catch (e) {
        res.status(500).send();
    }
});

// logout of all sessions
router.post('/users/logoutAll', auth, async(req, res) => {
    try {
        req.user.tokens = [];
        await req.user.save();
        res.send();
    } catch (e) {
        res.status(500).send();
    };
});

// read users by profile
router.get('/users/me', auth, async(req, res) => {
    res.send(req.user);
});

// update user by id
router.patch('/users/me', auth, async(req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'email', 'password', 'age'];
    const isValidOperation = updates.every((update) => {
        return allowedUpdates.includes(update);
    });

    if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid update!' });
    }

    try {
        updates.forEach((update) => {
            req.user[update] = req.body[update];
        });
        await req.user.save();
        res.send(req.user);
    } catch (e) {
        return res.status(400).send();
    }
});

// delete user by id
router.delete('/users/me', auth, async(req, res) => {
    try {
        await req.user.remove();
        res.send(req.user);
    } catch (e) {
        res.status(500).send();
    }
});

// upload/update profile picture
const upload = multer({
    limits: {
        fileSize: 1000000
    },
    fileFilter(req, file, cb) {
        if(!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            cb(new Error('File must be a jpg or jpeg or png'));
        }
        else 
            cb(undefined, true);
    }
});
router.post('/users/me/avatar', auth, upload.single('avatar'), async(req, res)=> {
        const buffer = await sharp(req.file.buffer)
                        .resize({ width:250, height:250 })
                        .png()
                        .toBuffer();

        req.user.avatar = buffer; 
        await req.user.save();
        res.send();
    }, (error, req, res, next)=>{
        res.status(400).send({error: error.message});
});

// delete profile picture
router.delete('/users/me/avatar', auth, async(req, res)=>{
    req.user.avatar = undefined;
    await req.user.save();
    res.send();
});

// fetch avatar
router.get('/users/:id/avatar', async(req, res)=>{
    try {
        const user = await User.findById(req.params.id);
        if(!user || !user.avatar) {
            throw new Error();
        }
        res.set('Content-Type', 'image/png');
        res.send(user.avatar);
    } catch (e) {
        res.status(404).send();
    }
});

module.exports = router