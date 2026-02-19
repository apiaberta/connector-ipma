import mongoose from 'mongoose'

const warningSchema = new mongoose.Schema({
  id:        String,
  aware_id:  String,
  level:     String,
  type:      String,
  text:      String,
  startTime: Date,
  endTime:   Date,
  region:    String,
  synced_at: { type: Date, default: Date.now }
})

warningSchema.index({ id: 1 }, { unique: true, sparse: true })
warningSchema.index({ endTime: 1 })
warningSchema.index({ level: 1 })

export const Warning = mongoose.model('Warning', warningSchema)
