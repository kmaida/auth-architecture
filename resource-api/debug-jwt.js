// Debug script to help diagnose JWT/JWKS issues
const jwt = require('jsonwebtoken');
const { default: fetch } = require('node-fetch');
require('dotenv/config');

const fusionAuthURL = process.env.AUTHZ_SERVER_URL || 'http://localhost:9011';

async function debugJWT() {
  console.log('=== JWT/JWKS Debug Information ===\n');
  
  // 1. Check JWKS endpoint
  console.log('1. Checking JWKS endpoint...');
  console.log(`JWKS URL: ${fusionAuthURL}/.well-known/jwks.json`);
  
  try {
    const jwksResponse = await fetch(`${fusionAuthURL}/.well-known/jwks.json`);
    const jwks = await jwksResponse.json();
    console.log('✅ JWKS endpoint accessible');
    console.log('Available keys:');
    jwks.keys.forEach((key, index) => {
      console.log(`  Key ${index + 1}:`);
      console.log(`    - kid: ${key.kid}`);
      console.log(`    - alg: ${key.alg}`);
      console.log(`    - use: ${key.use}`);
      console.log(`    - kty: ${key.kty}`);
    });
  } catch (error) {
    console.log('❌ Error fetching JWKS:', error.message);
    return;
  }
  
  console.log('\n2. To debug your access token:');
  console.log('   - Decode your JWT at https://jwt.io');
  console.log('   - Check the "kid" in the header matches one of the keys above');
  console.log('   - Check the "iss" (issuer) claim matches your FusionAuth URL');
  console.log('   - Check the "aud" (audience) claim contains your client IDs');
  
  console.log('\n   OR paste your access token below and run:');
  console.log('   const { decodeJWT } = require("./debug-jwt");');
  console.log('   decodeJWT("YOUR_ACCESS_TOKEN_HERE");');
  
  console.log('\n3. Environment variables:');
  console.log(`   - AUTHZ_SERVER_URL: ${process.env.AUTHZ_SERVER_URL}`);
  console.log(`   - CLIENT_ID_BFF_TMB: ${process.env.CLIENT_ID_BFF_TMB}`);
  console.log(`   - CLIENT_ID_BBOC: ${process.env.CLIENT_ID_BBOC}`);
}

// Function to decode JWT without verification (for debugging)
function decodeJWT(token) {
  if (!token) {
    console.log('❌ No token provided');
    return;
  }
  
  try {
    const decoded = jwt.decode(token, { complete: true });
    console.log('\n=== JWT Token Analysis ===');
    console.log('Header:', JSON.stringify(decoded.header, null, 2));
    console.log('Payload:', JSON.stringify(decoded.payload, null, 2));
    
    // Check key points
    console.log('\n=== Key Information ===');
    console.log(`Key ID (kid): ${decoded.header.kid}`);
    console.log(`Algorithm: ${decoded.header.alg}`);
    console.log(`Issuer: ${decoded.payload.iss}`);
    console.log(`Audience: ${decoded.payload.aud}`);
    console.log(`Expires: ${new Date(decoded.payload.exp * 1000)}`);
    console.log(`Issued at: ${new Date(decoded.payload.iat * 1000)}`);
    
  } catch (error) {
    console.log('❌ Error decoding JWT:', error.message);
  }
}

// Run the debug
debugJWT().catch(console.error);

// Export the decode function for manual use
module.exports = { decodeJWT };
