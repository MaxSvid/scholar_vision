Need to check ionos on VPS Firewall or Network Security for pgadmin4 vectors

❯ i need later git pull what he did in here and setup final project for deployment   

● Got it. When your teammate is done, on your local machine:

  # Make sure you're on main
  git checkout main

  # Pull his latest changes
  git pull origin main

  Then rebuild the frontend and test locally:

  cd front-end
  npm install       # in case he added new packages
  npm run build
  cd ..
  uv run uvicorn main:app --reload

  Check everything works at http://localhost:8000, then deploy to VPS:

  git push origin main   # if you have your own changes to merge
  ssh root@87.106.96.103
  cd scholar_vision
  git pull origin main
  docker-compose up -d --build


  Once you SSH into the VPS, just run:
                                                                                                                                            
  apt install -y caddy

  Create the config:
  nano /etc/caddy/Caddyfile

  Paste:
  scholarvision.uk, www.scholarvision.uk {
      reverse_proxy localhost:8000
  }

  Save, then:
  systemctl stop nginx
  systemctl disable nginx
  systemctl reload caddy

  That's it — Caddy automatically:
  1. Gets an SSL certificate from Let's Encrypt
  2. Renews it automatically before it expires
  3. Redirects http:// to https://

  Your site will show the padlock at https://scholarvision.uk within a minute or two of Caddy starting.


VPS:
- root@ubuntu:~#  mkdir -p /var/www
- root@ubuntu:~# cd /var/www
- root@ubuntu:/var/www#

  So the one-time setup on the VPS is:
  1. docker-compose up -d --build — starts the app
  2. Configure Caddy with your domain — connects domain to the app

  After that, everything runs 24/7 automatically including SSL renewal.