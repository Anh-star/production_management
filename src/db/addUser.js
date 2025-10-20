require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function addUser() {
  // --- User Details ---
  const username = 'testadmin';
  const password = 'password123';
  const role = 'Admin';
  const name = 'Test Admin User';
  // --------------------

  console.log(`Preparing to add user '${username}'...`);

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('Password hashed successfully.');

    const client = await pool.connect();
    console.log('Database connection established.');

    const query = `
      INSERT INTO users (username, password_hash, role, name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          name = EXCLUDED.name;
    `;
    const values = [username, hashedPassword, role, name];

    await client.query(query, values);
    client.release();

    console.log(`
   Success! User '${username}' has been created/updated.`);
    console.log(`You can now log in via Swagger or your API with:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);

  } catch (err) {
    console.error('\n Error adding user to the database:');
    console.error(err.message);
  } finally {
    await pool.end();
    console.log('\nDatabase connection closed.');
  }
}

addUser();
