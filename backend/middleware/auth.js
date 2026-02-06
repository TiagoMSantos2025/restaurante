const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Acesso negado. Nenhum token fornecido.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.usuarioId);

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: 'Token inválido ou usuário inativo.' });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Acesso negado. Autenticação necessária.' });
    }

    if (!roles.includes(req.usuario.tipo)) {
      return res.status(403).json({ error: 'Acesso negado. Permissões insuficientes.' });
    }

    next();
  };
};

module.exports = { auth, authorize };