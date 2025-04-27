// postcss.config.js
module.exports = {
    plugins: [
      require('postcss-discard-duplicates')(), // השתמש רק בזה
      // לא להכניס כאן את cssnano
    ],
  };