# Kuya Cares — Multi-Vendor Marketplace

A comprehensive, enterprise-grade **multi-vendor marketplace platform** built with Next.js 15, TypeScript, and modern cloud technologies.

Kuya Cares connects customers with multiple independent vendors and merchants through a unified marketplace experience, supporting vendor management, ordering, payments, delivery, analytics, and platform administration.

## 🌟 Platform Overview

Kuya Cares is a full-scale multi-vendor marketplace ecosystem featuring:

* **Admin Panel** — Complete marketplace management, analytics, users, vendors, orders, and financial operations
* **Vendor Panel** — Business, product, order, and sales management
* **Merchant Operations** — Support for multiple merchant/outlet operations under marketplace vendors
* **Customer App** — Mobile-first marketplace browsing, ordering, checkout, and order tracking
* **Delivery Integration** — Integrated delivery fulfillment and tracking
* **Payment Processing** — PayMongo-powered Philippine payment processing

## 🚀 Key Features

### 🔐 Authentication & Authorization

* Role-based access control
* Multi-panel authentication
* Admin, vendor, merchant, and customer access
* Secure server-side authentication
* Protected API routes
* Session and authorization management

### 🛡️ Admin Panel

* Comprehensive marketplace dashboard
* Real-time business analytics
* User management
* Vendor management
* Merchant management
* Order management
* Financial monitoring
* Payment monitoring
* Marketplace configuration
* System monitoring
* Responsive administrative interface

### 🏪 Vendor & Merchant Management

* Vendor profile management
* Multiple merchant/outlet support
* Product and catalog management
* Categories and product organization
* Merchant operational settings
* Business hours
* Order processing
* Sales analytics
* Vendor performance monitoring

### 📱 Customer Marketplace

* Mobile-first marketplace interface
* Vendor and merchant discovery
* Location-based discovery
* Product browsing
* Category filtering
* Search
* Shopping cart
* Wishlist
* Checkout
* Order history
* Real-time order status
* Delivery tracking
* Customer profile management

### 🛒 Multi-Vendor Marketplace

Kuya Cares is designed around a true multi-vendor marketplace model.

* Multiple vendors on one platform
* Multiple merchants/outlets per vendor
* Vendor-specific catalogs
* Merchant-specific inventory and availability
* Vendor and merchant order management
* Marketplace-wide order management
* Vendor-level analytics
* Platform-level analytics

### 💳 Payment Integration

* **PayMongo** — Philippine payment gateway
* Live and sandbox payment environments
* GCash support
* Card payments
* Maya support
* GrabPay support
* Payment intent processing
* Webhook processing
* Webhook signature verification
* Secure server-side payment operations

### 🚚 Delivery & Fulfillment

* Lalamove integration
* Production and sandbox environments
* Delivery quotation
* Delivery booking
* Delivery status tracking
* Merchant-to-customer fulfillment
* Delivery API integration
* Order fulfillment workflow

### 🔔 Notifications

* Push notification support
* Order notifications
* Payment notifications
* Delivery notifications
* Status updates
* Notification management
* Token management
* Background notification handling

### 📊 Advanced Analytics

* **ECharts** for business intelligence and visualization
* Strategic 90/10 implementation approach
* React-based charts for standard business visualizations
* Direct ECharts usage for advanced visualizations
* Revenue analytics
* Order analytics
* Vendor performance analytics
* Merchant performance analytics
* Customer behavior analytics
* Delivery analytics
* Interactive dashboards

### 🗺️ Location & Maps

* Google Maps integration
* Location search
* Address autocomplete
* Geocoding
* Distance calculations
* Delivery radius calculations
* Location-based marketplace discovery
* Delivery location validation

### 🔍 Search & Discovery

* Advanced marketplace search
* Fuzzy matching
* Typo-tolerant search
* Vendor and merchant search
* Product search
* Category filtering
* Search suggestions
* Search indexing infrastructure

### ☁️ Cloud Storage

* Cloudinary integration
* Product image management
* Vendor and merchant media
* Optimized image delivery
* Image transformations
* Upload management

---

# 🛠️ Technology Stack

## Core Framework

* **Next.js 15** — React framework with App Router
* **TypeScript** — Type-safe application development
* **React 19**
* **Tailwind CSS** — Utility-first styling

## State Management

* **Redux Toolkit**
* **RTK Query**
* **React Context**
* **Redux Persist**

## Backend & Database

* **Payload CMS**
* **PostgreSQL**
* **Supabase PostgreSQL**
* Server-side API architecture
* TypeScript business logic services
* REST API integrations

## Infrastructure

* **Google Cloud Run** — Containerized application deployment
* **Cloudflare** — DNS, proxying, caching, and edge services
* **Upstash Redis** — Caching and high-speed data access
* **Cloudinary** — Media storage and optimization

## Payments & Fulfillment

* **PayMongo** — Philippine payment processing
* **Lalamove API** — Delivery fulfillment
* **Google Maps API** — Location and mapping services

## Analytics

* **ECharts**
* **echarts-for-react**
* Real-time business dashboards
* Performance analytics

## Search

* Elasticsearch/OpenSearch-compatible search infrastructure
* Fuzzy marketplace search
* Search indexing

---

# 📁 Project Structure

```text
kuya-cares/

├── apps/
│   ├── web/
│   │   └── # Customer marketplace
│   ├── web-admin/
│   │   └── # Admin panel
│   ├── web-merchant/
│   │   └── # Merchant operations
│   ├── web-driver/
│   │   └── # Delivery operations
│   └── landing/
│       └── # Public marketplace landing page
│
├── packages/
│   ├── api-client/
│   │   └── # Shared API client
│   ├── cms-types/
│   │   └── # Shared CMS types
│   ├── course-actions/
│   │   └── # Shared server actions/services
│   └── ...
│
├── apps/cms/
│   └── # Payload CMS backend
│
├── docs/
│   └── # Technical documentation
│
├── scripts/
│   └── # Development and database utilities
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

# 🚀 Getting Started

## Prerequisites

* **Node.js 18+**
* **pnpm**
* **PostgreSQL / Supabase**
* **Payload CMS**
* **PayMongo account**
* **Lalamove API credentials**
* **Google Maps API credentials**
* **Cloudinary account**
* **Upstash Redis**
* **Cloudflare account** for production infrastructure

## Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd kuya-cares
pnpm install
```

## Environment Configuration

Create the required environment configuration for the application.

Example:

```env
# Database
DATABASE_URI=postgresql://...

# Payload CMS
PAYLOAD_SECRET=your_payload_secret

# PayMongo
PAYMONGO_SANDBOX=false
PAYMONGO_PUBLIC_KEY_LIVE=your_public_key
PAYMONGO_SECRET_KEY_LIVE=your_secret_key
PAYMONGO_SANDBOX_API_KEY=your_sandbox_key
PAYMONGO_WEBHOOK_SECRET=your_webhook_secret
PAYMONGO_SANDBOX_WEBHOOK_SECRET=your_sandbox_webhook_secret

# Lalamove
LALAMOVE_SANDBOX=false
LALAMOVE_API_KEY=your_production_api_key
LALAMOVE_API_SECRET=your_production_api_secret
LALAMOVE_SANDBOX_API_KEY=your_sandbox_api_key
LALAMOVE_SANDBOX_API_SECRET=your_sandbox_api_secret
LALAMOVE_MARKET=PH

# Google Maps
NEXT_PUBLIC_MAPS_FRONTEND_KEY=your_frontend_key
MAPS_BACKEND_KEY=your_backend_key

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Redis
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Never commit production credentials, API secrets, webhook secrets, or private keys to source control.**

## Development

Run the appropriate workspace application using the project's pnpm/Turborepo scripts.

```bash
pnpm install
```

Build the project:

```bash
pnpm build
```

Run type checking:

```bash
pnpm tsc --noEmit
```

Run linting:

```bash
pnpm lint
```

---

# 🏗️ Architecture

Kuya Cares follows a multi-application architecture designed to separate marketplace concerns while allowing shared packages and services.

```text
                         KUYA CARES
                              │
             ┌────────────────┼────────────────┐
             │                │                │
        Customer App      Admin Panel      Merchant App
             │                │                │
             └────────────────┼────────────────┘
                              │
                         API / BFF Layer
                              │
              ┌───────────────┼───────────────┐
              │               │               │
          Payload CMS      PostgreSQL       Redis
              │               │               │
              └───────────────┼───────────────┘
                              │
          ┌───────────────────┼──────────────────┐
          │                   │                  │
       PayMongo           Lalamove          Google Maps
```

---

# 📱 Application Areas

## Customer Marketplace

* Homepage
* Vendor discovery
* Merchant discovery
* Product browsing
* Search
* Categories
* Cart
* Checkout
* Orders
* Order tracking
* Wishlist
* Profile

## Admin Panel

* Dashboard
* Users
* Vendors
* Merchants
* Orders
* Payments
* Delivery
* Analytics
* Financial management
* Marketplace configuration

## Merchant Panel

* Dashboard
* Business profile
* Products
* Categories
* Orders
* Sales
* Analytics
* Operating hours
* Settings

## Driver / Delivery Operations

* Delivery requests
* Active deliveries
* Delivery status
* Location tracking
* Delivery history
* Earnings

---

# 🔌 API Integrations

## PayMongo

Used for:

* Payment intent creation
* Payment processing
* Payment method handling
* Webhook processing
* Payment status updates

## Lalamove

Used for:

* Delivery quotation
* Delivery booking
* Delivery tracking
* Fulfillment status

## Google Maps

Used for:

* Address search
* Geocoding
* Distance calculations
* Location discovery
* Delivery location validation

## Cloudinary

Used for:

* Product images
* Vendor/merchant images
* Media uploads
* Image optimization

---

# 🚀 Deployment

Kuya Cares is designed for cloud-native deployment.

### Google Cloud Run

Application services are deployed as containerized workloads on Google Cloud Run.

### Cloudflare

Used for:

* DNS
* Proxying
* Edge caching
* Security
* Traffic management

### PostgreSQL / Supabase

Primary relational database for marketplace data.

### Upstash Redis

Used for:

* Caching
* Frequently accessed data
* Performance optimization
* Temporary application state

---

# 📊 Performance Architecture

Kuya Cares emphasizes efficient data access and caching rather than repeatedly loading large datasets from the database.

The platform uses:

* Server-side aggregation
* Database-level queries
* Redis caching
* Client-side caching
* RTK Query
* Cloudflare caching where appropriate
* Optimized API/BFF endpoints
* Pagination
* Selective data loading

The goal is to minimize unnecessary database queries and reduce latency across marketplace dashboards and customer-facing experiences.

---

# 🔐 Security

* Server-side secret management
* Role-based authorization
* Protected API endpoints
* PayMongo webhook signature verification
* Secure payment processing
* Restricted API credentials
* Environment-specific credentials
* Input validation
* Database access controls
* Production secret isolation

Production credentials must never be committed to Git repositories.

---

# 🎨 Design Principles

Kuya Cares follows a professional marketplace-oriented design system:

* Mobile-first experience
* Responsive layouts
* Clean marketplace UI
* Fast navigation
* Professional loading states
* Skeleton loading where appropriate
* Clear order status indicators
* Consistent component system
* Accessible UI patterns
* Smooth interactions
* Responsive dashboards

---

# 🔮 Future Enhancements

* [ ] React Native mobile application
* [ ] Real-time customer/vendor chat
* [ ] Loyalty and rewards system
* [ ] Multi-language support
* [ ] Dark mode
* [ ] Progressive Web App
* [ ] AI-powered recommendations
* [ ] Advanced marketplace reporting
* [ ] Vendor advertising system
* [ ] Promotional campaigns
* [ ] Advanced customer segmentation
* [ ] Additional delivery providers
* [ ] Social commerce integrations

---

# 📄 License

This project is licensed under the MIT License.

---

# 🤝 Contributing

Contributions are welcome.

### Development Guidelines

1. Follow TypeScript best practices.
2. Maintain consistent project architecture.
3. Keep shared logic inside appropriate packages.
4. Avoid unnecessary duplication.
5. Validate changes with type checking.
6. Run linting before submitting changes.
7. Update documentation when architecture or behavior changes.
8. Keep secrets and production credentials out of source control.

---

# 👨‍💻 Developer

**Kuya Cares** is developed by **Software Engineer John Lloyd Callao**.

* **Lead Developer:** John Lloyd Callao
* **Role:** Full-Stack Software Engineer
* **Specialization:** Enterprise web applications, multi-vendor marketplaces, cloud-native systems, and business platforms

---

# ❤️ Kuya Cares

**Kuya Cares — A Multi-Vendor Marketplace**

Built with ❤️ using Next.js, TypeScript, Payload CMS, PostgreSQL, and modern cloud technologies.
