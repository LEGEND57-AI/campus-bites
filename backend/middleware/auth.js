import jwt from 'jsonwebtoken';
import { supabase } from '../db.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, phone, role') // 🔥 FIX HERE
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;

    console.log("AUTH USER:", req.user); // debug

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};