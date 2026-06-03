import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function testBuyNowLink() {
  console.log('🔍 Checking products with buyNowLink...\n');
  
  const snapshot = await db.collection('products').limit(5).get();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`📦 ${data.name}`);
    console.log(`   Product Type: ${data.productType}`);
    console.log(`   buyNowLink: ${data.buyNowLink || '(kosong)'}`);
    console.log(`   Button Color: ${data.buyNowLink ? '🟢 GREEN #04B851' : '⚫ BLACK #11151E'}`);
    console.log('');
  });
}

testBuyNowLink().catch(console.error).finally(() => process.exit(0));
