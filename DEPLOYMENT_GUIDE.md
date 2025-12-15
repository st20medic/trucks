# Lincoln EMS Truck Tracker - Deployment Guide

## 🚀 Production Deployment to lincolnems.com/trucks

This guide covers deploying the Lincoln EMS Truck Tracker application to production at `lincolnems.com/trucks`.

## 📋 Prerequisites

### 1. Firebase Project Setup
- [ ] Firebase project created and configured
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] Firebase Storage enabled for photo uploads
- [ ] Security rules configured

### 2. Domain Configuration
- [ ] Access to lincolnems.com domain
- [ ] Ability to create subdirectory `/trucks`
- [ ] Web server access (Apache/Nginx)

### 3. Environment Variables
Copy `env.example` to `.env` and configure with your Firebase credentials:

```bash
cp env.example .env
```

Edit `.env` with your production Firebase configuration:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_production_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Environment
VITE_APP_ENV=production
```

## 🏗️ Build Process

### 1. Build the Application
```bash
npm run build
```

This creates a `dist/` folder with optimized production files.

### 2. Build Output
The build generates:
- `dist/index.html` - Main HTML file
- `dist/assets/` - Optimized CSS, JavaScript, and other assets
- All files are minified and optimized for production

## 📁 Deployment Options

### Option 1: Direct File Upload
1. Upload all contents of the `dist/` folder to `lincolnems.com/trucks/`
2. Ensure the web server serves `index.html` for the `/trucks` route

### Option 2: Git-based Deployment
1. Push the `dist/` folder to your web server's git repository
2. Configure automatic deployment on push

### Option 3: CI/CD Pipeline
1. Set up GitHub Actions or similar CI/CD service
2. Automate build and deployment process

## 🌐 Web Server Configuration

### Apache Configuration
Create `.htaccess` file in the `/trucks` directory:

```apache
RewriteEngine On
RewriteBase /trucks/

# Handle client-side routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /trucks/index.html [L]

# Security headers
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"

# Cache static assets
<FilesMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 year"
</FilesMatch>
```

### Nginx Configuration
Add to your Nginx server block:

```nginx
location /trucks {
    alias /path/to/your/trucks/dist;
    try_files $uri $uri/ /trucks/index.html;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    
    # Cache static assets
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🔒 Security Configuration

### 1. Firebase Security Rules
Configure Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Trucks - authenticated users can read, admins can write
    match /trucks/{truckId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Maintenance records - authenticated users can read, admins can write
    match /maintenance/{recordId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### 2. Firebase Storage Rules
Configure Storage security rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Truck photos - authenticated users can read, admins can write
    match /trucks/{truckId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.resource.size < 5 * 1024 * 1024 && // 5MB limit
        request.resource.contentType.matches('image/.*');
    }
  }
}
```

## 🧪 Testing Deployment

### 1. Pre-deployment Checklist
- [ ] All environment variables configured
- [ ] Firebase project properly set up
- [ ] Security rules configured
- [ ] Build successful with no errors
- [ ] Local testing completed

### 2. Post-deployment Testing
- [ ] Application loads at `lincolnems.com/trucks`
- [ ] Authentication works
- [ ] Truck data loads correctly
- [ ] Equipment management functions
- [ ] Photo uploads work
- [ ] Print functionality works
- [ ] Mobile responsiveness

### 3. Performance Testing
- [ ] Page load times under 3 seconds
- [ ] Image optimization working
- [ ] Caching headers properly set
- [ ] Gzip compression enabled

## 📱 Mobile Optimization

The application is already optimized for mobile with:
- Responsive design using Tailwind CSS
- Touch-friendly interface
- Optimized loading for mobile networks
- Progressive Web App features

## 🔄 Updates and Maintenance

### 1. Code Updates
1. Make changes in development
2. Test locally
3. Build with `npm run build`
4. Deploy updated `dist/` folder

### 2. Database Maintenance
- Regular backups of Firestore data
- Monitor Firebase usage and costs
- Review security rules periodically

### 3. Performance Monitoring
- Monitor Firebase performance
- Track user analytics
- Monitor error rates and performance metrics

## 🆘 Troubleshooting

### Common Issues

#### 1. 404 Errors on Refresh / Redirecting to Base URL
**Problem**: When refreshing `lincolnems.com/trucks`, the page redirects to `lincolnems.com` instead of staying on the trucks page.

**Solution**: This is a common SPA (Single Page Application) routing issue. The web server needs to be configured to serve `index.html` for all routes under `/trucks`.

**Apache Solution**: Ensure `.htaccess` file is in the `/trucks` directory with:
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /trucks/index.html [L]
```

**Nginx Solution**: Add to server configuration:
```nginx
location /trucks {
    try_files $uri $uri/ /trucks/index.html;
}
```

**Verification**: After implementing the fix:
1. Go to `lincolnems.com/trucks`
2. Refresh the page (F5 or Ctrl+R)
3. The page should stay on `/trucks` and not redirect to the base URL

#### 2. Firebase Connection Issues
- Verify environment variables are correct
- Check Firebase project configuration
- Ensure security rules allow access

#### 3. Photo Upload Failures
- Check Firebase Storage rules
- Verify file size limits
- Check authentication status

#### 4. Slow Loading
- Enable Gzip compression
- Check caching headers
- Optimize image sizes

## 📞 Support

For deployment issues:
1. Check Firebase console for errors
2. Review web server logs
3. Test locally with production environment variables
4. Contact system administrator for server configuration

## 🎯 Success Metrics

Deployment is successful when:
- ✅ Application loads at `lincolnems.com/trucks`
- ✅ All features function correctly
- ✅ Authentication system works
- ✅ Data loads and saves properly
- ✅ Mobile experience is smooth
- ✅ Performance meets requirements

---

**Last Updated**: $(date)
**Version**: Production Build
**Status**: Ready for Deployment
