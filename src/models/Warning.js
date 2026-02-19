import mongoose from 'mongoose'

const warningSchema = new mongoose.Schema({
  id:        { type: String, required: true, unique: true },
  aware_id:  String,
  level:     String, // green, yellow, orange, red
  type:      String,
  text:      String,
  startTime: Date,
  endTime:   Date,
  region:    String,
  synced_at: { type: Date, default: Date.now }
})

warningSchema.index({ endTime: 1 })
warningSchema.index({ level: 1 })

export const Warning = mongoose.model('Warning', warningSchema)
