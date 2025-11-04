const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@paymentgateway.com';
const DEFAULT_ADMIN_ROLE = process.env.DEFAULT_ADMIN_ROLE || 'super_admin';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/payment-gateway';

const saltRounds = 10;

// Admin schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['super_admin', 'admin'], required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const AdminModel = mongoose.model('Admin', adminSchema);

async function seedAdmin() {
  let retries = 10;
  let connected = false;

  // Retry connection with exponential backoff
  while (retries > 0 && !connected) {
    try {
      console.log(`Connecting to MongoDB... (${11 - retries}/10)`);
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB');
      connected = true;
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error('❌ Failed to connect to MongoDB after 10 retries:', error);
        process.exit(1);
      }
      console.log('MongoDB not ready, retrying in 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  try {
    // Check if any admin exists
    const adminCount = await AdminModel.countDocuments();
    
    if (adminCount > 0) {
      console.log('Admin accounts already exist, skipping seed');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, saltRounds);

    // Create default admin
    const admin = new AdminModel({
      username: DEFAULT_ADMIN_USERNAME,
      password: hashedPassword,
      email: DEFAULT_ADMIN_EMAIL,
      role: DEFAULT_ADMIN_ROLE,
      isActive: true,
    });

    await admin.save();

    console.log(`✅ Default admin account created successfully: ${DEFAULT_ADMIN_USERNAME}`);
    console.log(`⚠️  Default admin credentials:`);
    console.log(`   Username: ${DEFAULT_ADMIN_USERNAME}`);
    console.log(`   Password: ${DEFAULT_ADMIN_PASSWORD}`);
    console.log(`   Email: ${DEFAULT_ADMIN_EMAIL}`);
    console.log(`   Role: ${DEFAULT_ADMIN_ROLE}`);
    console.log(`⚠️  Please change the default password after first login!`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed default admin:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedAdmin();

