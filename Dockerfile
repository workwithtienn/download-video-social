FROM node:18-alpine

# Cài đặt python3, ffmpeg và các thư viện cần thiết tối thiểu
RUN apk add --no-cache python3 py3-pip ffmpeg curl

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Tăng giới hạn RAM cho Node để tránh bị kill
ENV NODE_OPTIONS="--max-old-space-size=512"

EXPOSE 3000
CMD ["node", "index.js"]
