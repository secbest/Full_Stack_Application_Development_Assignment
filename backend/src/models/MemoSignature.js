const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// Signature record attached to a service memo. Multiple signatures allowed per memo
// (patient + crew supervisor). When a patient cannot sign, is_waived = true with a
// mandatory waiver_reason. signed_at is the immutable audit timestamp.
const MemoSignature = sequelize.define('MemoSignature', {
  id:                  { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  memo_id:             { type: DataTypes.INTEGER,     allowNull: false, references: { model: 'service_memos', key: 'id' } },
  signer_name:         { type: DataTypes.STRING(255), allowNull: false },
  signature_image_url: { type: DataTypes.STRING(512), allowNull: true },
  signed_at:           { type: DataTypes.DATE,        allowNull: false },
  is_waived:           { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: false },
  waiver_reason:       { type: DataTypes.TEXT,        allowNull: true },
}, {
  tableName: 'memo_signatures',
  underscored: true,
})

module.exports = MemoSignature
