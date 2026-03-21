FROM php:8.2-apache

# Install system dependencies required for dlib, OpenCV, and Python
RUN (apt-get update || apt-get update --allow-releaseinfo-change) && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    cmake \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Setup PHP extensions and Apache Proxy
RUN docker-php-ext-install pdo pdo_mysql
RUN a2enmod rewrite proxy proxy_http

# Create Apache config for port forwarding /api to Python server (5001)
RUN echo "ProxyPass /api/ http://127.0.0.1:5001/\nProxyPassReverse /api/ http://127.0.0.1:5001/" > /etc/apache2/conf-available/python-api.conf && \
    a2enconf python-api

WORKDIR /var/www/html

# Copy requirements and install Python packages
COPY requirements.txt .

# Use a virtual environment (best practice for Debian-based Docker images)
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python packages
RUN pip install --no-cache-dir setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . /var/www/html
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80 5001

# Start both Apache for PHP and the Python Face Recognition API Server
RUN echo '#!/bin/bash\npython3 face_recognition_server.py &\napache2-foreground\n' > /start.sh && \
    chmod +x /start.sh

CMD ["/start.sh"]
