import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (password.length < 10 || password.length > 72) {
      return res.status(400).json({ message: 'Password must be between 10 and 72 characters.' });
    }
    if (await User.exists({ role: 'admin' })) {
      return res.status(403).json({ message: 'An admin account already exists. Ask an administrator to provision access.' });
    }
    const user = await User.create({ name, email, password, role: 'admin' });
    return res.status(201).json({ message: 'Admin account created.', user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' });
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    const token = jwt.sign(
      { sub: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '12h' },
    );
    return res.json({ token, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export default router;