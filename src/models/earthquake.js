import mongoose from 'mongoose'

const earthquakeSchema = new mongoose.Schema({
  event_key:    { type: String, required: true, unique: true },
  sismo_id:     { type: String, default: null },
  area_id:      { type: Number, required: true, enum: [3, 7] },
  region:       { type: String, required: true, enum: ['acores', 'continente-madeira'] },
  time:         { type: Date, required: true },
  lat:          { type: Number, required: true },
  lon:          { type: Number, required: true },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }
  },
  depth_km:     { type: Number, default: null },
  magnitude:    { type: Number, default: null },
  mag_type:     String,
  intensity:    { type: String, default: null },
  sensed:       { type: Boolean, default: null },
  obs_region:   String,
  source:       String,
  shakemap_url: { type: String, default: null },
  map_url:      { type: String, default: null },
  data_update:  { type: Date, default: null },
  first_seen:   { type: Date, default: Date.now },
  last_seen:    { type: Date, default: Date.now }
}, { collection: 'earthquakes' })

earthquakeSchema.index({ time: -1 })
earthquakeSchema.index({ area_id: 1, time: -1 })
earthquakeSchema.index({ magnitude: -1 })
earthquakeSchema.index({ location: '2dsphere' })

export const Earthquake = mongoose.model('Earthquake', earthquakeSchema)
