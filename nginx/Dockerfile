FROM nginx:alpine
RUN apk add --no-cache apache2-utils
RUN htpasswd -b -c /etc/nginx/.htpasswd incois demo2024
COPY nginx.conf /etc/nginx/nginx.conf
