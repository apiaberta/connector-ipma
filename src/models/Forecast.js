import mongoose from 'mongoose'

const forecastSchema = new mongoose.Schema({
  cityId:      { type: Number, required: true },
  cityName:    { type: String, required: true },
  date:        { type: String, required: true }, // YYYY-MM-DD
  tMin:        Number,
  tMax:        Number,
  description: String,
  precipProb:  Number,
  windDir:     String,
  windSpeed:   Number,
  synced_at:   { type: Date, default: Date.now }
})

forecastSchema.index({ cityId: 1, date: 1 }, { unique: true })
forecastSchema.index({ cityId: 1 })
forecastSchema.index({ date: 1 })

export const Forecast = mongoose.model('Forecast', forecastSchema)
