FROM node:16 AS client-build

ENV AWS_ACCESS_KEY_ID XXAWSID
ENV AWS_SECRET_ACCESS_KEY XXAWSSECRET
ENV AWS_SESSION_TOKEN XXAWSSESSION
ENV SPOTIFY_CLIENT_ID XXID
ENV SPOTIFY_REDIRECT_URI XXREDIRECT
ENV SPOTIFY_CLIENT_SECRET XXSECRET
ENV YOUTUBE_KEY XXYOUTUBE
ENV TWITTER_TOKEN XXTWITTER

WORKDIR /usr/app/client/
COPY client/package*.json ./
RUN npm install
COPY client/src/ ./src
COPY client/public/ ./public
RUN npm run build

FROM node:16 AS server-build
WORKDIR /usr/app/server
COPY --from=client-build /usr/app/client/build/ ./build
WORKDIR /usr/app/server/
COPY server/package*.json ./ 
RUN npm install
COPY server/ ./

EXPOSE 3001

CMD ["npm", "start"]