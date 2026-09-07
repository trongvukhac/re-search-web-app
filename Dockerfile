FROM node:22-alpine

# Cài đặt thư mục làm việc
WORKDIR /app

# Copy package.json và cài đặt dependency (nếu có, hiện tại app không có dependency ngoài)
COPY package.json ./
# RUN npm install # Bỏ comment nếu có thêm package sau này

# Copy toàn bộ mã nguồn vào container
COPY . .

# Đảm bảo thư mục data tồn tại và có quyền ghi
RUN mkdir -p data && chmod 777 data

# Mở port 3000
EXPOSE 3000

# Chạy app
CMD ["npm", "start"]
