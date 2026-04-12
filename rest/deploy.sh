pm2 stop admin

pm2 delete admin

npm install
npx prisma generate
rm -rf .next/
npm run build
pm2 reload admin || pm2 start npm --name admin -- start
