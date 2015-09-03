# Dockerfile extending the generic Node image with application files for a
# single application.
FROM gcr.io/google_appengine/nodejs

# Uncomment and customize these if you're copying this by hand (use "app
# gen-config" to generate a Dockerfile.
# ADD package.json npm-shrinkwrap.json* /app/
# RUN npm install
# ADD . /app
COPY package.json /app/
RUN npm install
COPY . /app/
CMD npm start
