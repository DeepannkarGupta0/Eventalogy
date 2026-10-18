import { db } from '../config/firebase';

async function main() {
  const status = process.argv[2] || 'pending';
  const verified = status === 'active';
  
  await db.collection('vendors').doc('vend_test1').update({
    status: status,
    verified: verified,
  });
  
  console.log('SUCCESS: vend_test1 status=' + status + ', verified=' + verified);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
