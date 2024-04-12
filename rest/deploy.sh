pm2 stop admin

pm2 delete admin

npm install

rm -rf .next

npm run build

pm2 start npm --name admin -- start
