const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);

module.exports = {
  beforeCreate(event) {
    event.params.data.doc_uid = nanoid();
  },
};
