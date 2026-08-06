FROM node:20-bullseye-slim

# ১. সিস্টেম ডিপেন্ডেন্সি ইন্সটল (python3 এবং python এলিয়াস সহ)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python-is-python3 \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ২. ডিপেন্ডেন্সি কপি ও ইন্সটল
COPY package*.json ./
RUN npm install --omit=dev

# ৩. সোর্স কোড কপি
COPY . .

EXPOSE 8000

CMD ["node", "src/index.js"]
