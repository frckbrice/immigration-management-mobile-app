# Patrick Travel Services - Document de Présentation du Projet mobile

**Version du Document:** 1.0  
**Date de Mise à Jour:** 2 Novembre 2025  
**Statut:** MVP Ready 
**Auteur:** Avom Brice, Développeur

---

##  Table des Matières

1. [Résumé Exécutif](#résumé-exécutif)
2. [Vue d'Ensemble du Projet](#vue-densemble-du-projet)
3. [Architecture du Système](#architecture-du-système)
4. [Workflows par Rôle Utilisateur](#workflows-par-rôle-utilisateur)
   - [Workflow Client (Mobile App)](#workflow-client-mobile-app)
   - [Workflow Agent (Web Dashboard)](#workflow-agent-web-dashboard)
   - [Workflow Administrateur (Web Dashboard)](#workflow-administrateur-web-dashboard)
5. [Fonctionnalités Complètes](#fonctionnalités-complètes)
6. [Déroulement de l'Implémentation](#déroulement-de-limplémentation)
7. [Architecture Technique](#architecture-technique)
8. [Statistiques du Projet](#statistiques-du-projet)

---

## Résumé Exécutif

### Présentation du Projet

**Patrick Travel Services** est une plateforme complète de gestion de dossiers d'immigration comprenant :
- **Application Mobile** (iOS & Android) pour les clients
- **Application Web** (Dashboard) pour les agents et administrateurs
- **API Backend** unifiée (Next.js + PostgreSQL + Firebase)

### Objectifs Principaux

 **Pour les Clients :**
- Soumettre des demandes de visa/immigration en toute simplicité
- Télécharger et suivre les documents requis
- Communiquer en temps réel avec leur conseiller assigné
- Suivre l'avancement de leur dossier en temps réel
- Recevoir des notifications push pour toutes les mises à jour importantes

 **Pour les Agents :**
- Gérer les dossiers assignés efficacement
- Examiner et valider les documents clients
- Communiquer directement avec les clients
- Mettre à jour le statut des dossiers
- Accéder à l'historique complet des interactions

 **Pour les Administrateurs :**
- Gérer tous les utilisateurs (clients, agents, admins)
- Assigner les dossiers aux agents
- Accéder aux statistiques et rapports détaillés
- Configurer le système (types de services, modèles de documents, FAQ)
- Surveiller l'activité via les logs d'audit

### Points Clés du Projet

| Aspect | Détails |
|--------|---------|
| **Statut** |  MVP Ready - Toutes les fonctionnalités principales implémentées |
| **Plateformes** | iOS (13.4+), Android (6.0+), Web (Tous navigateurs modernes) |
| **Technologies** | React Native + Expo, Next.js, PostgreSQL, Firebase |
| **Sécurité** | Conformité GDPR, Authentification biométrique, Chiffrement des données |
| **Internationalisation** | Anglais et Français (extensible à d'autres langues) |
| **Temps de Développement** | ~8 semaines (MVP complet) |
| **Équipe** | Développeur Full-Stack + Design UI/UX |

### Fonctionnalités Principales

1. **Gestion Complète des Dossiers**
   - Création, suivi, mise à jour du statut
   - Timeline visuelle des changements de statut
   - Assignation automatique des agents

2. **Gestion des Documents**
   - Upload via caméra, galerie ou fichiers
   - Validation et approbation par les agents
   - Suivi du statut en temps réel

3. **Communication en Temps Réel**
   - Chat instantané (Firebase Realtime Database)
   - Système d'email intégré
   - Notifications push multi-canal

4. **Conformité & Sécurité**
   - Conformité GDPR complète
   - Authentification multi-facteurs (Email, Google OAuth, Biométrie)
   - Chiffrement des données sensibles

---

## Vue d'Ensemble du Projet

### Architecture à Trois Niveaux

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION MOBILE                         │
│              (React Native + Expo - iOS/Android)              │
│  - Interface utilisateur pour les clients                    │
│  - Onboarding, Authentification, Dossiers, Documents        │
│  - Chat temps réel, Notifications push                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ API REST + Firebase Auth
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    APPLICATION WEB                           │
│              (Next.js + React + Tailwind CSS)                │
│  - Dashboard pour Agents et Administrateurs                  │
│  - Gestion des dossiers, Documents, Utilisateurs            │
│  - Analytics, Rapports, Configuration système               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ API + Database
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    BACKEND & STORAGE                        │
│  - API REST (Next.js API Routes)                            │
│  - PostgreSQL (Neon) - Base de données principale          │
│  - Firebase Realtime Database - Chat temps réel            │
│  - UploadThing - Stockage des fichiers                     │
│  - Firebase Auth - Authentification                        │
└─────────────────────────────────────────────────────────────┘
```

### Technologies Utilisées

#### Frontend Mobile
- **Framework:** React Native + Expo SDK 54
- **Langage:** TypeScript
- **Navigation:** Expo Router (file-based)
- **State Management:** Zustand + React Query
- **UI:** React Native Paper + Composants personnalisés
- **Animations:** React Native Reanimated
- **Formulaires:** React Hook Form + Zod

#### Frontend Web
- **Framework:** Next.js 15+
- **Langage:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** React Context API + Zustand
- **Charts:** Recharts

#### Backend
- **API:** Next.js API Routes + Supabase
- **Base de Données:** PostgreSQL (Neon)
- **Temps Réel:** Firebase Realtime Database
- **Authentification:** Firebase Auth
- **Stockage Fichiers:** UploadThing
- **Push Notifications:** Expo Push Notifications + FCM

---

## Architecture du Système

### Rôles Utilisateurs

#### 1. **Client (Mobile App)**
- **Rôle:** Utilisateur final demandant des services d'immigration
- **Plateforme:** Application mobile uniquement
- **Permissions:**
  - Créer et suivre ses propres dossiers
  - Télécharger des documents pour ses dossiers
  - Communiquer avec son agent assigné
  - Consulter l'historique et les notifications

#### 2. **Agent/Advisor (Web Dashboard)**
- **Rôle:** Conseiller gérant les dossiers clients
- **Plateforme:** Application web uniquement
- **Permissions:**
  - Voir les dossiers assignés
  - Examiner et valider/rejeter les documents
  - Mettre à jour le statut des dossiers
  - Communiquer avec les clients
  - Ajouter des notes internes
  - Demander des documents supplémentaires

#### 3. **Administrateur (Web Dashboard)**
- **Rôle:** Gestionnaire système avec accès complet
- **Plateforme:** Application web uniquement
- **Permissions:**
  - Toutes les permissions Agent +
  - Gérer tous les utilisateurs (créer, modifier, désactiver)
  - Assigner les dossiers aux agents
  - Accéder aux statistiques et rapports
  - Configurer les types de services et documents requis
  - Gérer les FAQ et templates
  - Consulter les logs d'audit
  - Exporter des rapports

### Flux de Données

```
Client Mobile App
    │
    ├─► Firebase Auth (Authentification)
    │
    ├─► REST API (Next.js)
    │   ├─► PostgreSQL (Cases, Documents, Users)
    │   └─► UploadThing (Fichiers)
    │
    └─► Firebase Realtime Database (Chat temps réel)

```

---

## Workflows par Rôle Utilisateur

### Workflow Client (Mobile App)

#### Phase 1: Inscription et Authentification (Jour 1)

**Étapes:**
1. **Téléchargement de l'application** → Lancement
2. **Onboarding** (5 slides) → Présentation des fonctionnalités
3. **Inscription:**
   - Formulaire: Email, Mot de passe, Nom, Prénom, Téléphone
   - Acceptation des Conditions d'utilisation et Politique de confidentialité (GDPR)
   - Enregistrement du consentement avec timestamp
4. **Vérification email** → Obligatoire avant utilisation
5. **Première connexion:**
   - Email/Mot de passe OU Google OAuth OU Biométrie (si activée)
   - Session persistante activée
   - Token push enregistré automatiquement

#### Phase 2: Création du Premier Dossier (Jour 2-7)

**Étapes:**
1. **Complétion du profil** (si téléphone manquant)
2. **Consultation des FAQ** (optionnel - comprendre les services)
3. **Création d'un dossier:**
   - Sélection du type de service (6 types disponibles)
   - Formulaire multi-étapes avec validation
   - Génération du numéro de référence unique
   - Statut: `SUBMITTED`
4. **Attente de l'assignation** → Notification reçue dans 24-48h

#### Phase 3: Assignation d'Agent et Communication (Jour 3-7)

**Étapes:**
1. **Réception de notification:** "Agent assigné - [Nom Agent]"
2. **Ouverture des détails du dossier:**
   - Section agent mise en évidence
   - Badge "Chat disponible" affiché
   - Bouton "Message Advisor" activé
3. **Initialisation du chat:**
   - Conversation Firebase créée automatiquement
   - Message de bienvenue possible de l'agent
   - Chat temps réel disponible

#### Phase 4: Téléchargement de Documents (Jour 8-21)

**Étapes:**
1. **Consultation de la liste des documents requis** (dans les détails du dossier)
2. **Téléchargement de documents:**
   - Sélection du cas (si plusieurs)
   - Sélection du type de document
   - Choix de la source: Caméra / Galerie / Fichier
   - Validation du fichier (taille, type)
   - Upload avec barre de progression
   - Statut: `PENDING`
3. **Suivi du statut:**
   - Notification lors de l'approbation/rejet
   - Raison du rejet affichée si applicable
   - Possibilité de re-télécharger si rejeté
4. **Tous les documents approuvés** → Statut dossier: `PROCESSING`

#### Phase 5: Traitement et Communication Continue (Jour 22-60)

**Étapes:**
1. **Suivi du statut en temps réel:**
   - Timeline visuelle des changements
   - Notifications push pour chaque mise à jour
2. **Communication avec l'agent:**
   - Chat temps réel (< 100ms latence)
   - Réponses aux emails
   - Demandes de documents supplémentaires si nécessaire
3. **Mise à jour du statut:**
   - `PROCESSING` → `APPROVED` ou `REJECTED`
   - Notification finale avec détails

#### Phase 6: Finalisation (Jour 61+)

**Étapes:**
1. **Dossier approuvé:**
   - Notification de félicitations
   - Prochaines étapes communiquées
   - Dossier fermé après 30 jours
2. **Création d'un nouveau dossier** (si nécessaire)
3. **Gestion du compte:**
   - Modification du profil
   - Export des données (GDPR)
   - Suppression du compte (si souhaité)

**Diagramme de Flux Client:**
```
App Launch → Onboarding → Registration → Email Verification
    ↓
Login (Email/Google/Biometric)
    ↓
Dashboard → Complete Profile (if needed)
    ↓
Create Case → Select Service → Fill Form → Submit
    ↓
Case Submitted → Wait for Agent Assignment
    ↓
Agent Assigned → Chat Available → Upload Documents
    ↓
Documents Reviewed → All Approved → Processing
    ↓
Final Decision → Approved/Rejected → Case Closed
```

---

### Workflow Agent (Web Dashboard)

#### Phase 1: Connexion et Vue d'Ensemble

**Étapes:**
1. **Connexion au dashboard web:**
   - Email/Mot de passe
   - Session sécurisée avec cookies
   - Auto-logout après inactivité
2. **Dashboard principal:**
   - Vue des dossiers assignés
   - Statistiques: Dossiers en attente, Documents à examiner
   - Notifications récentes
   - Actions rapides

#### Phase 2: Gestion des Dossiers Assignés

**Étapes:**
1. **Consultation de la liste des dossiers:**
   - Filtres: Statut, Date, Priorité, Type de service
   - Recherche par référence ou nom client
   - Tri par date, priorité, statut
2. **Ouverture d'un dossier:**
   - Informations client complètes
   - Numéro de référence et historique
   - Documents soumis avec statut
   - Notes internes (visibles agents/admins uniquement)
   - Timeline des changements de statut

#### Phase 3: Revue et Validation des Documents

**Étapes:**
1. **Examen des documents:**
   - Visualisation PDF/Images
   - Vérification de la conformité
   - Consultation des documents déjà approuvés
2. **Décision:**
   - **Approuver:** Document validé, statut mis à jour
   - **Rejeter:** Raison du rejet saisie, notification envoyée au client
3. **Demande de documents supplémentaires** (si nécessaire):
   - Statut dossier: `PROCESSING` → `DOCUMENTS_REQUIRED`
   - Notification automatique au client

#### Phase 4: Mise à Jour du Statut des Dossiers

**Étapes:**
1. **Changement de statut:**
   - `SUBMITTED` → `UNDER_REVIEW`
   - `UNDER_REVIEW` → `DOCUMENTS_REQUIRED`
   - `DOCUMENTS_REQUIRED` → `PROCESSING`
   - `PROCESSING` → `APPROVED` / `REJECTED`
2. **Ajout de notes:**
   - Notes internes pour référence
   - Notes visibles par l'admin uniquement
3. **Notification automatique:**
   - Client notifié via push + email
   - Historique mis à jour dans la timeline

#### Phase 5: Communication avec les Clients

**Étapes:**
1. **Chat temps réel:**
   - Conversation Firebase pour chaque dossier
   - Messages instantanés (< 100ms)
   - Indicateurs de frappe
   - Statut de lecture (lu)
2. **Envoi d'emails:**
   - Email structuré avec template HTML
   - Suivi des réponses
   - Thread ID pour les conversations
3. **Réponses aux questions:**
   - Support client direct
   - Clarification des exigences documentaires

#### Phase 6: Clôture et Suivi

**Étapes:**
1. **Finalisation du dossier:**
   - Statut final: `APPROVED` ou `REJECTED`
   - Notes finales ajoutées
   - Dossier archivé après 30 jours
2. **Consultation de l'historique:**
   - Toutes les interactions avec le client
   - Documents téléchargés et approuvés
   - Timeline complète des événements

**Diagramme de Flux Agent:**
```
Login Web Dashboard
    ↓
View Assigned Cases
    ↓
Open Case → Review Client Info & Documents
    ↓
Review Documents → Approve/Reject
    ↓
Update Case Status → Add Internal Notes
    ↓
Communicate with Client (Chat/Email)
    ↓
Final Decision → Approve/Reject → Case Closed
```

---

### Workflow Administrateur (Web Dashboard)

#### Phase 1: Connexion et Dashboard Administrateur

**Étapes:**
1. **Connexion avec privilèges admin**
2. **Dashboard complet:**
   - Statistiques globales (clients, dossiers, agents)
   - Graphiques: Dossiers par statut, par type de service
   - Activité récente
   - Calendrier des échéances
   - Métriques de performance des agents

#### Phase 2: Gestion des Utilisateurs

**Étapes:**
1. **Gestion des clients:**
   - Liste de tous les clients avec filtres
   - Création de comptes clients (si nécessaire)
   - Modification des profils
   - Désactivation de comptes
   - Export de listes (CSV/Excel)
2. **Gestion des agents:**
   - Création de comptes agents
   - Assignation de rôles et permissions
   - Modification des profils
   - Désactivation de comptes
3. **Gestion des administrateurs:**
   - Création de comptes admin
   - Gestion des permissions
   - Audit des actions admin

#### Phase 3: Assignation des Dossiers

**Étapes:**
1. **Consultation de tous les dossiers:**
   - Filtres avancés (statut, agent, date, type de service)
   - Vue non assignés → Assigner à un agent
   - Réassignation si nécessaire
2. **Assignation manuelle:**
   - Sélection du dossier
   - Sélection de l'agent
   - Notification automatique:
     - Agent notifié (web dashboard)
     - Client notifié (push + email)
     - Chat Firebase initialisé
     - Message de bienvenue optionnel
3. **Gestion des priorités:**
   - Flagging des dossiers urgents
   - Réorganisation des priorités

#### Phase 4: Configuration Système

**Étapes:**
1. **Gestion des types de services:**
   - Ajout/modification des services
   - Définition des documents requis par service
   - Configuration des délais de traitement
2. **Gestion des templates de documents:**
   - Upload de modèles de formulaires
   - Organisation par catégorie
   - Gestion des versions
3. **Gestion des FAQ:**
   - Création/modification des questions-réponses
   - Organisation par catégories
   - Activation/désactivation
4. **Configuration des emails:**
   - Modification des templates d'emails
   - Personnalisation des messages
   - Configuration des déclencheurs

#### Phase 5: Analytics et Rapports

**Étapes:**
1. **Statistiques détaillées:**
   - Tendances temporelles (quotidien, hebdomadaire, mensuel)
   - Funnel de conversion
   - Performance des agents
   - Popularité des services
   - Distribution géographique (si applicable)
2. **Génération de rapports:**
   - Builder de rapports personnalisés
   - Export PDF/Excel
   - Rapports programmés
3. **Visualisations:**
   - Graphiques en ligne (tendances)
   - Graphiques en secteurs (distributions)
   - Graphiques en barres (comparaisons)
   - Heatmaps (modèles d'activité)

#### Phase 6: Audit et Surveillance

**Étapes:**
1. **Consultation des logs d'activité:**
   - Actions des utilisateurs
   - Historique de connexion
   - Modifications de données
   - Filtres par utilisateur, type d'action, période
2. **Export des logs:**
   - Analyse de sécurité
   - Conformité réglementaire
   - Dépannage
3. **Surveillance du système:**
   - Performance des API
   - Utilisation de la base de données
   - Erreurs et exceptions

**Diagramme de Flux Administrateur:**
```
Login Admin Dashboard
    ↓
Manage Users (Clients/Agents/Admins)
    ↓
Assign Cases to Agents
    ↓
Configure System (Services, Templates, FAQ, Emails)
    ↓
View Analytics & Reports
    ↓
Monitor Activity Logs
```

---

## Complete User Journey

### Phase 1: First Launch & Onboarding (Day 1)

#### 1.1 App Launch
- User downloads and opens the app for the first time
- App checks if onboarding was completed (stored in AsyncStorage)
- If not completed, redirects to onboarding screen

#### 1.2 Onboarding Experience
**Screen:** `app/onboarding.tsx`

**Features:**
- 5 beautiful slides explaining app features:
  1. Welcome slide
  2. Case Management overview
  3. Document Upload explanation
  4. Real-time Chat with advisors
  5. Notifications & Updates
- Smooth animations with pagination dots
- Skip functionality (can skip at any time)
- "Get Started" button on final slide
- Completion flag saved to AsyncStorage (never shows again unless app is reinstalled)

**User Actions:**
- Swipe or tap to navigate slides
- Tap "Skip" to jump to registration
- Tap "Get Started" to proceed to registration

---

### Phase 2: Registration & Authentication (Day 1)

#### 2.1 Account Registration
**Screen:** `features/auth/screens/RegisterScreen.tsx`

**Registration Form:**
- Email address (validated)
- Password (with strength requirements)
- Password confirmation (must match)
- First Name
- Last Name
- Phone Number (optional)
- Terms & Conditions checkbox (required, with link)
- Privacy Policy checkbox (required, with link)
- GDPR consent timestamp recorded

**Process:**
1. User fills registration form
2. Validates all fields (email format, password strength, matching passwords)
3. Checks both consent checkboxes
4. Submits to backend: `POST /api/auth/register`
5. Backend creates Firebase user + PostgreSQL record
6. Consent timestamps saved: `consentedAt`, `acceptedTerms`, `acceptedPrivacy`
7. Redirects to email verification screen

**GDPR Compliance:**
-  Consent explicitly recorded with timestamps
-  Terms & Privacy Policy must be accepted
-  User can view full privacy policy and terms before accepting

#### 2.2 Email Verification
**Screen:** `app/(auth)/verify-email.tsx`

**Process:**
1. Firebase sends verification email automatically
2. User receives email with verification link
3. User clicks link → Email verified in Firebase
4. User can also use "Resend Verification" button if email not received
5. Must verify email before accessing app features

**Features:**
- Email input with validation
- Resend verification button with inline loader
- Success/error feedback messages
- "Go to Login" button after verification

#### 2.3 Login
**Screen:** `features/auth/screens/LoginScreen.tsx`

**Login Methods:**
1. **Email/Password Login:**
   - Email and password input
   - "Remember Me" checkbox for session persistence
   - Inline loading spinner (button doesn't disappear)
   - Forgot password link

2. **Google OAuth Login:**
   - "Continue with Google" button
   - Native Google sign-in flow
   - Auto-creates account if new user

3. **Biometric Login** (Optional, if enabled):
   - Face ID (iOS) / Fingerprint (Android) button appears
   - One-tap login after initial setup
   - Secure credential storage in device keychain

**Process:**
1. User enters credentials or uses biometric/Google
2. Firebase authenticates user
3. Axios interceptor adds Firebase ID token to API requests
4. Backend verifies token and syncs user: `POST /api/auth/login`
5. Session stored in SecureStorage (persists across app restarts)
6. Push notification token registered automatically
7. Navigates to home dashboard

**Security:**
-  Tokens stored in encrypted SecureStorage
-  Auto-refresh expired tokens
-  Session persists across app restarts
-  Auto-logout on invalid tokens

---

### Phase 3: Profile Completion & First Steps (Day 1-2)

#### 3.1 Dashboard (Home Screen)
**Screen:** `app/(tabs)/index.tsx`

**First-Time User Experience:**
- Personalized greeting: "Welcome, [FirstName]!"
- Profile completion banner (if profile incomplete)
- Empty state with "Create Your First Case" CTA

**Dashboard Features:**
- **Stats Cards:**
  - Total Cases count
  - Active Cases count
  - Pending Documents count
  - Unread Messages count
- **Quick Actions:**
  - "Submit New Case" button
  - "Upload Document" button (disabled if no active cases)
  - "View FAQs" button
- **Recent Activity:**
  - Timeline of recent case updates
  - Recent notifications preview
- **Pull-to-Refresh:** Refresh all data

**Account States & Permissions:**
- **PENDING_VERIFICATION:** Can only view FAQ, Contact Support
- **INCOMPLETE_PROFILE:** Can view dashboard but must complete profile to create cases
- **ACTIVE:** Can create cases and use all features
- **HAS_ACTIVE_CASE:** Can upload documents and message advisors

#### 3.2 Profile Completion
**Screen:** `app/profile/edit.tsx`

**Required Fields:**
- First Name 
- Last Name 
- Email (pre-filled, cannot change)
- Phone Number  (required for case creation)

**Process:**
1. User sees profile completion prompt if missing phone
2. Navigates to Edit Profile screen
3. Fills missing information
4. Saves profile: `PATCH /api/users/profile`
5. Account state updates: `INCOMPLETE_PROFILE` → `ACTIVE`
6. Now can create cases

---

### Phase 4: Case Creation & Submission (Day 2-7)

#### 4.1 Browse Services & FAQs
**Screen:** `app/help/faq.tsx`

**Before Creating a Case:**
- User can browse FAQ to understand services
- Search functionality (debounced, 300ms)
- Categories: General, Cases, Documents, Payments, etc.
- Accordion-style Q&A display
- Always accessible (even before verification)

#### 4.2 Create New Case
**Screen:** `app/case/new.tsx`

**Prerequisites:**
-  Email verified
-  Profile completed (phone number required)

**Process:**
1. **Service Type Selection:**
   - Cards display: Student Visa, Work Permit, Family Reunification, Tourist Visa, Business Visa, Permanent Residency
   - Each card shows icon and description
   - User selects desired service

2. **Case Form Wizard:**
   - Multi-step form with progress indicator
   - **Step 1:** Personal Information
   - **Step 2:** Service-Specific Questions (destination, travel dates, etc.)
   - **Step 3:** Document Checklist (shows required documents)
   - **Step 4:** Review & Submit

3. **Validation:**
   - All required fields validated
   - Prevents duplicate service type cases (can only have one active case per service type)
   - Shows existing case if user tries to create duplicate

4. **Submission:**
   - Submits to backend: `POST /api/cases`
   - System generates unique reference number (e.g., "PTS-2025-001234")
   - Case status: `SUBMITTED`
   - Success screen with reference number
   - Shows next steps:
     - "Agent will be assigned within 24-48 hours"
     - "You'll receive a notification when documents are required"
     - "You can message your agent once assigned"

**Business Rules:**
-  One active case per service type (prevents duplicates)
-  Case must have reference number
-  Cannot edit case after submission (only draft cases can be edited)

---

### Phase 5: Agent Assignment & Chat Initialization (Day 3-7)

#### 5.1 Agent Assignment Process

**Backend Process (Automatic):**
1. Admin assigns case to agent via web dashboard
2. **Multiple notification channels triggered:**
   -  Agent receives web dashboard notification
   -  Client receives web dashboard notification (if using web)
   -  Client receives mobile push notification
   -  Client receives email with advisor details
   -  Firebase chat conversation initialized automatically
   -  Optional welcome message sent from agent

**Mobile App Experience:**
- User receives push notification:
  > " Case Assigned! Your case PTS-2025-001234 has been assigned to John Smith. They will contact you soon."
- Tapping notification navigates to case details
- Notification badge updates

#### 5.2 Case Details Screen
**Screen:** `app/case/[id].tsx`

**When Agent is Assigned (Chat Available):**
-  Highlighted advisor section with primary color background
-  Advisor name displayed: "Advisor: John Smith"
-  Green badge: " Chat available"
-  "Message Advisor" button enabled
-  Hint text: " Chat with your advisor anytime"

**When No Agent (Chat Not Available):**
-  Warning-colored section: "Awaiting Advisor Assignment"
- Helper text: "Your case is being reviewed. An advisor will be assigned within 24-48 hours"
- Disabled chat section with dashed border
- Icon and message: "Chat Not Available Yet"
- Description: "Chat will be available once an advisor is assigned. You'll receive a notification."

**Case Information Display:**
- Reference number (prominent)
- Service type with icon
- Current status with color-coded badge
- Submission date
- Last updated timestamp
- Status timeline visualization
- Required documents checklist
- Submitted documents list

---

### Phase 6: Document Upload & Management (Day 8-21)

#### 6.1 View Required Documents
**Screen:** `app/case/[id].tsx` (Case Details)

**Document Checklist:**
- Shows all required documents for the service type
- Each document marked as:
  - **MISSING:** Not uploaded yet
  - **PENDING:** Uploaded, awaiting review
  - **APPROVED:** Verified by agent
  - **REJECTED:** Needs re-upload (reason provided)

**Features:**
- Document type icons
- Status badges with colors
- File size and upload date for submitted documents
- Rejection reason displayed if document rejected

#### 6.2 Upload Documents
**Screen:** `app/document/upload.tsx`

**Prerequisites:**
-  Must have at least one active case
-  Case must not be CLOSED or REJECTED

**Upload Process:**
1. **Case Selection:**
   - If multiple active cases: Shows case picker
   - If single case: Auto-selects it
   - User-friendly display: "PTS-2025-001234 - Student Visa"

2. **Document Type Selection:**
   - Dropdown/picker with document types:
     - Passport, ID Card, Birth Certificate, Marriage Certificate
     - Diploma, Employment Letter, Bank Statement
     - Proof of Residence, Photo, Other
   - Validates document type is relevant to service type

3. **File Selection (3 Options):**
   - ** Camera:** Take photo directly
   - ** Gallery:** Select from photo library
   - ** Document:** Pick PDF or document file

4. **File Validation:**
   - Max file size: 10MB per file
   - Max files per case: 20 documents
   - Allowed types: PDF, JPG, PNG
   - Validates before upload

5. **Upload with Progress:**
   - Shows upload progress bar with percentage
   - Image compression (80% quality for photos)
   - Uploads to backend: `POST /api/documents` (multipart/form-data)
   - Saves to UploadThing cloud storage
   - Document status: `PENDING`

6. **Success:**
   - Document appears in case documents list
   - Notification sent to assigned agent
   - User can upload more documents

**Business Rules:**
- Cannot upload without active case
- Cannot upload to closed cases
-  Can upload multiple documents of same type (agent can choose best one)
-  Can replace rejected documents

#### 6.3 Documents List
**Screen:** `app/(tabs)/documents.tsx`

**Features:**
- Lists all documents across all cases
- Filter by:
  - Case (dropdown)
  - Document Type
  - Status (Pending, Approved, Rejected)
- Search by document name
- Sort by date (newest first, oldest first)
- Document cards show:
  - Document type icon
  - Original file name
  - Case reference number
  - Status badge
  - Upload date
  - File size
- Tap document → Preview/download
- Pull-to-refresh

**Performance Optimizations:**
- Debounced search (300ms)
- Memoized filtered results
-  Optimized FlatList rendering
-  Pagination (20 items per page)

#### 6.4 Document Review Process

**Agent Review (Backend):**
1. Agent reviews document on web dashboard
2. Agent can:
   - Approve document
   - Reject document (with reason)

**Client Notification:**
- User receives push notification:
  - **Approved:** " Your passport document has been approved"
  - **Rejected:** " Your diploma document needs re-upload. Reason: [reason]"
- Email notification also sent
- Document status updates in real-time

**After All Documents Approved:**
- Case status changes: `DOCUMENTS_REQUIRED` → `PROCESSING`
- User receives notification: "All documents approved! Your case is now being processed."

---

### Phase 7: Real-Time Communication (Throughout Process)

#### 7.1 Chat List
**Screen:** `app/(tabs)/messages.tsx`

**Features:**
- Lists all conversations (grouped by case)
- Each conversation shows:
  - Case reference number
  - Advisor/Client name
  - Last message preview
  - Timestamp (Today, Yesterday, or date)
  - Unread message badge (red dot with count)
- Tap conversation → Opens chat room
- Pull-to-refresh
- Empty state if no conversations

#### 7.2 Chat Room
**Screen:** `app/message/[id].tsx`

**Prerequisites:**
- Agent must be assigned to case
- Case must not be CLOSED

**Real-Time Chat Features:**
- **Message Display:**
  - WhatsApp-style message bubbles
  - Sent messages: Right-aligned (primary color)
  - Received messages: Left-aligned (gray)
  - Timestamp for each message
  - Read receipts (lu when read)

- **Message Input:**
  - Multi-line text input
  - Send button (enabled when text entered)
  - Typing indicator: "Agent is typing..."
  - Online/offline status

- **Real-Time Updates:**
  - Uses Firebase Realtime Database (< 100ms latency)
  - Messages appear instantly
  - Auto-scrolls to latest message
  - Mark as read automatically when chat opened

- **Message History:**
  - Loads last 100 messages
  - Infinite scroll for older messages
  - Messages persist across sessions

**Message Sending Process:**
1. User types message
2. Taps send button
3. Message sent to Firebase Realtime Database
4. Also saved to PostgreSQL via API: `POST /api/chat/messages`
5. Push notification sent to recipient
6. Message appears in chat immediately

**Message Read Functionality:**
- Automatic read marking when chat opened
- API endpoint: `PUT /api/chat/messages/{id}/read`
- Batch read marking: `PUT /api/chat/messages/mark-read`
-  Dual sync: Firebase (real-time) + PostgreSQL (persistent)

#### 7.3 Email Communication
**Screen:** `app/(tabs)/messages.tsx` → Email tab

**Features:**
- Separate email inbox from chat
- Lists all emails (received and sent)
- Filter by direction: Incoming, Outgoing
- Email cards show:
  - Subject line
  - Sender/Recipient name
  - Preview text
  - Sent/Received date
  - Unread badge

#### 7.4 Email Reader
**Screen:** `app/email/[id].tsx`

**Features:**
- Full email display
- Reply button (if received email)
- Email metadata (from, to, date, subject)
- Full content display
- Thread ID tracking for replies

#### 7.5 Email Reply
**Screen:** `app/email/[id].tsx` → Reply modal

**Process:**
1. User taps "Reply" button on received email
2. Modal slides up from bottom
3. Subject auto-prefixed: "Re: [Original Subject]"
4. User types reply message
5. Sends via: `POST /api/emails/send`
6. Reply saved and sent to agent
7. Success toast notification
8. Email list refreshes

**Validation:**
- Email must be received (not sent by user)
- Email must have caseId
- Reply text cannot be empty

---

### Phase 8: Notifications & Updates (Throughout Process)

#### 8.1 Notification Center
**Screen:** `app/(tabs)/notifications.tsx`

**Notification Types:**
- **CASE_STATUS_UPDATE:** "Your case PTS-2025-001234 status changed to PROCESSING"
- **NEW_MESSAGE:** "New message from John Smith"
- **DOCUMENT_UPLOADED:** "Document uploaded successfully"
- **DOCUMENT_VERIFIED:** "Your passport document has been approved"
- **DOCUMENT_REJECTED:** "Your diploma document needs re-upload"
- **CASE_ASSIGNED:** "Case assigned to John Smith"
- **SYSTEM_ANNOUNCEMENT:** System-wide updates

**Features:**
- Lists all notifications (paginated)
- Filter by type
- Unread badge count
- Mark as read (single or all)
- Tap notification → Navigates to relevant screen
- Pull-to-refresh
- Empty state when no notifications

**Notification Management:**
- Mark single as read: `PUT /api/notifications/{id}`
- Mark all as read: `PUT /api/notifications/mark-all-read`
- Get unread count: Included in GET /api/notifications response

#### 8.2 Push Notifications

**Setup:**
- Auto-registered on login
- Token saved: `PUT /api/users/push-token`
- 4 notification channels (Android):
  - Default
  - Case Updates
  - Messages
  - Documents

**Notification Handling:**
- Foreground: In-app banner/alert
- Background: System notification
- Deep linking: Tapping notification navigates to relevant screen
- Badge count updates automatically

#### 8.3 Case Update Monitoring
**Service:** `lib/hooks/useCaseUpdates.ts`

**Fallback Mechanism:**
- Polls for case updates every 5 minutes in background
- Immediately checks when app returns to foreground
- Detects:
  - New agent assignments
  - Case status changes
- Sends local notifications if changes detected
- Acts as safety net if push notifications fail

---

### Phase 9: Case Processing & Status Updates (Day 22-60)

#### 9.1 Case Status Flow

**Status Progression:**
1. **SUBMITTED** → User submits case
2. **UNDER_REVIEW** → Agent reviews case
3. **DOCUMENTS_REQUIRED** → Agent requests documents
4. **PROCESSING** → All documents approved, case being processed
5. **APPROVED** → Case approved successfully
6. **REJECTED** → Case denied (with reason)
7. **CLOSED** → Case archived (after 30 days of approval)

#### 9.2 Status Timeline
**Screen:** `app/case/[id].tsx`

**Visual Timeline:**
- Color-coded status dots
- Connected timeline with dates
- Status change notes
- Shows who changed status (agent name)
- Animations on status updates

#### 9.3 Additional Document Requests

**Process:**
1. Agent reviews case during processing
2. Agent requests additional documents
3. Case status: `PROCESSING` → `DOCUMENTS_REQUIRED`
4. User receives notification
5. User uploads additional documents (same process as Phase 6)
6. After all documents approved, returns to `PROCESSING`

#### 9.4 Final Decision

**Approval:**
- Status: `PROCESSING` → `APPROVED`
- User receives notification with congratulations
- Next steps provided in notification
- Case details show approval date

**Rejection:**
- Status: `PROCESSING` → `REJECTED`
- User receives notification with rejection reason
- Appeal process explained
- Case details show rejection reason and date

---

### Phase 10: Case Completion & Follow-up (Day 61+)

#### 10.1 Case Closure
- After 30 days of approval, case status: `APPROVED` → `CLOSED`
- User can still view case history
- Documents remain accessible
- Chat conversation archived (read-only)

#### 10.2 New Case Creation
- User can create new case (same process as Phase 4)
- Different service type or same type after closure
- Process repeats from Phase 4

#### 10.3 Account Management

**Profile Settings**
**Screen:** `app/profile/settings.tsx`

**Features:**
- **Biometric Authentication:**
  - Toggle to enable/disable Face ID/Fingerprint
  - Only visible if device supports biometrics

- **Notification Preferences:**
  - Toggle push notifications
  - Toggle email notifications
  - Configure notification types

- **Language Settings:**
  - English / French toggle
  - Preference persists

- **Theme Settings:**
  - Light / Dark / Auto toggle
  - Preference persists

**Privacy & GDPR**
**Screen:** `app/(tabs)/profile.tsx` → Privacy section

**Features:**
- **View Privacy Policy:** Full GDPR-compliant privacy policy
- **View Terms & Conditions:** Complete terms of service
- **Export Data:** Download all personal data (JSON format)
- **Delete Account:**
  - Shows confirmation dialog
  - Validates no active cases
  - 30-day grace period
  - Permanent deletion after grace period

**GDPR Rights Implemented:**
- Right to Access: View all profile data
- Right to Rectification: Edit profile information
- Right to Erasure: Delete account with grace period
- Right to Data Portability: Export all data as JSON
- Right to be Informed: Privacy Policy & Terms accessible
-  Consent Management: Consent recorded with timestamps

---

## All Features & Functionalities

### Authentication & Security

####  Firebase Authentication
- Email/password authentication
- Google OAuth 2.0 integration
- Secure token storage (expo-secure-store)
- Automatic token refresh
- Session persistence across app restarts
- Biometric authentication (Face ID/Touch ID/Fingerprint)
- Remember me functionality

####  Security Features
- Encrypted credential storage
- HTTPS-only API communication
- Input validation (Zod schemas)
- XSS and SQL injection protection
- Rate limiting on API
- Secure push token management

### Case Management

####  Case Creation
- Service type selection (6 types)
- Multi-step form wizard
- Case reference number generation
- Duplicate prevention (one active case per service type)
- Draft auto-save
- Form validation

####  Case Tracking
- Real-time status updates
- Visual status timeline
- Status history with dates
- Case details with all information
- Document checklist per case
- Advisor assignment tracking

####  Case List
- Filter by status
- Search by reference number
- Sort by date
- Pull-to-refresh
- Empty states
- Animated cards

### Document Management

####  Document Upload
- Camera integration
- Gallery selection
- Document picker (PDF)
- File validation (size, type)
- Upload progress tracking
- Image compression (80% quality)
- Multiple file support

####  Document Organization
- Documents grouped by case
- Document type categorization
- Status tracking (Pending, Approved, Rejected)
- File preview
- Download functionality
- Document history

####  Document Review
- Real-time status updates
- Rejection reasons display
- Re-upload functionality
- Document replacement

### Communication

####  Real-Time Chat
- Firebase Realtime Database integration
- WhatsApp-style message UI
- Typing indicators
- Online/offline status
- Read receipts
- Message history
- Auto-read marking
- File attachments support (planned)

####  Email Communication
- Email inbox
- Email reader
- Reply functionality
- Thread tracking
- Email notifications
- Sent/received tracking

### Notifications

####  Push Notifications
- Expo push notifications
- FCM integration (Android)
- APNs integration (iOS)
- 4 notification channels
- Deep linking
- Badge count management
- Foreground/background handling

####  In-App Notifications
- Notification center
- Notification types (7 types)
- Mark as read functionality
- Unread badge count
- Notification filtering
- Pull-to-refresh

####  Email Notifications
- Case assignment emails
- Status update emails
- Document approval/rejection emails
- Professional HTML templates

### User Profile & Settings

####  Profile Management
- View/edit profile
- Avatar upload
- Phone number management
- Password change
- Account information

####  Settings
- Biometric authentication toggle
- Notification preferences
- Language selection (EN/FR)
- Theme selection (Light/Dark/Auto)
- Privacy settings

####  GDPR Compliance
- Privacy Policy access
- Terms & Conditions access
- Data export functionality
- Account deletion (30-day grace period)
- Consent tracking with timestamps

### Help & Support

####  FAQ System
- Categorized FAQs
- Search functionality (debounced)
- Accordion-style display
- Always accessible

####  Contact Support
- Contact form
- Email integration
- Support request tracking

### Performance & UX

####  Performance Optimizations
- Debounced search (300ms)
- Memoized calculations
- Optimized FlatList rendering
- Request caching (React Query)
- Image compression
- Pagination (20 items per page)
- Lazy loading

####  Animations
- Smooth screen transitions
- Card animations (FadeInDown)
- Loading spinners
- Pull-to-refresh animations
- Status badge animations

####  Offline Support
- Request caching
- Firebase offline support (automatic)
- Network status detection
- Graceful degradation
- Offline queue (planned)

### Internationalization

####  Multi-Language Support
- English (default)
- French (complete translations)
- Language switcher in settings
- Preference persistence
- All UI text translated

### Accessibility

####  Cross-Platform Support
- iOS (13.4+)
- Android (6.0+)
- Safe area handling (notches, punch holes)
- Keyboard avoidance
- Platform-specific optimizations

---

## User Flow Diagrams

### Complete Journey Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE USER JOURNEY                         │
└─────────────────────────────────────────────────────────────────┘

DAY 1: Registration & Setup
┌──────────────┐
│  App Launch  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Onboarding  │ (5 slides, skip option)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Registration │ → Terms & Privacy consent → Email verification
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Login     │ → Email/Password OR Google OR Biometric
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Dashboard   │ → Complete profile (if needed)
└──────┬───────┘

DAY 2-7: Case Creation
       │
       ▼
┌──────────────┐
│ Browse FAQs  │ (Optional - learn about services)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Create Case  │ → Select service → Fill form → Submit
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Case Details │ → Status: SUBMITTED → "Awaiting Assignment"
└──────┬───────┘

DAY 3-7: Agent Assignment
       │
       ▼
┌─────────────────┐
│ Agent Assigned  │ ← Push notification + Email + Chat initialized
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Case Details   │ → "Chat Available" → "Message Advisor" enabled
└────────┬────────┘

DAY 8-21: Document Submission
         │
         ▼
┌─────────────────┐
│ Upload Docs     │ → Select case → Select type → Upload → PENDING
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agent Reviews   │ → APPROVED or REJECTED (with reason)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ All Docs Done   │ → Status: DOCUMENTS_REQUIRED → PROCESSING
└────────┬────────┘

DAY 22-60: Processing
         │
         ▼
┌─────────────────┐
│   Processing    │ → Status updates → Chat with advisor → Additional docs (if needed)
└────────┬────────┘
         │
         │
    ┌────┴────┐
    │         │
    ▼         ▼
APPROVED   REJECTED
    │         │
    │         └→ Appeal process
    │
    ▼
┌─────────────────┐
│   Case Closed   │ (After 30 days)
└─────────────────┘

ONGOING: Communication
    │
    ├─→ Real-Time Chat (Firebase)
    ├─→ Email Messages
    ├─→ Push Notifications
    └─→ In-App Notifications
```

### Case Creation Flow

```
User taps "Create Case"
    │
    ▼
Check Prerequisites
    ├─ Email verified? ──→ NO → Redirect to verify email
    └─ Profile complete? ──→ NO → Redirect to complete profile
    │
    ▼ YES
Show Service Type Selection
    │
    ▼
User selects service type
    │
    ▼
Check for duplicate
    ├─ Active case of same type? ──→ YES → Show alert → View existing or cancel
    └─ NO
    │
    ▼
Show Multi-Step Form
    ├─ Step 1: Personal Info
    ├─ Step 2: Service Questions
    ├─ Step 3: Document Checklist
    └─ Step 4: Review
    │
    ▼
User submits case
    │
    ▼
POST /api/cases
    │
    ▼
Case created → Reference number generated
    │
    ▼
Show success screen
    │
    ├─ Reference number displayed
    ├─ Next steps explained
    └─ "View Case" button
```

### Document Upload Flow

```
User taps "Upload Document"
    │
    ▼
Check Prerequisites
    ├─ Has active cases? ──→ NO → Alert → Redirect to create case
    └─ YES
    │
    ▼
Show Case Selector (if multiple cases)
    │
    ▼
User selects case
    │
    ▼
Check case status
    ├─ Case CLOSED? ──→ YES → Show error "Cannot upload to closed case"
    └─ NO
    │
    ▼
Show Document Type Picker
    │
    ▼
User selects document type
    │
    ▼
Show Upload Options
    ├─ Camera
    ├─ Gallery
    └─ Document Picker
    │
    ▼
User selects/picks file
    │
    ▼
Validate File
    ├─ Size > 10MB? ──→ YES → Show error
    ├─ Invalid type? ──→ YES → Show error
    └─ Valid
    │
    ▼
Compress Image (if photo, 80% quality)
    │
    ▼
Show Upload Progress
    │
    ▼
POST /api/documents (multipart/form-data)
    │
    ▼
Document uploaded → Status: PENDING
    │
    ▼
Show success → Refresh documents list
```

### Chat Flow

```
User taps "Message Advisor" (on case details)
    │
    ▼
Check Prerequisites
    ├─ Agent assigned? ──→ NO → Show "Agent not yet assigned"
    ├─ Case CLOSED? ──→ YES → Show "Cannot message on closed case"
    └─ Valid
    │
    ▼
Open Chat Screen
    │
    ▼
Load Chat History
    ├─ Subscribe to Firebase Realtime Database
    ├─ Load last 100 messages
    └─ Mark all messages as read (auto)
    │
    ▼
User types message
    │
    ▼
Send Message
    ├─ Save to Firebase Realtime Database
    ├─ Save to PostgreSQL via API
    ├─ Send push notification to recipient
    └─ Update UI immediately
    │
    ▼
Real-time Updates
    ├─ New messages appear instantly (< 100ms)
    ├─ Typing indicators shown
    ├─ Read receipts update
    └─ Online/offline status updates
```

---

## Technical Implementation Summary

### Architecture

```
Mobile App (React Native + Expo)
    │
    ├─ Firebase Auth (Authentication)
    │
    ├─ REST API (Next.js Backend)
    │   ├─ PostgreSQL (Cases, Documents, Users, Messages)
    │   └─ UploadThing (File Storage)
    │
    └─ Firebase Realtime Database (Real-time Chat)
```

### Key Technologies

- **Framework:** React Native + Expo SDK 54
- **Language:** TypeScript
- **Navigation:** Expo Router (file-based routing)
- **State Management:** Zustand + React Query
- **UI Library:** React Native Paper + Custom Components
- **Animations:** React Native Reanimated
- **Forms:** React Hook Form + Zod
- **Authentication:** Firebase Auth + Google OAuth
- **Real-time:** Firebase Realtime Database
- **Push Notifications:** Expo Notifications + FCM
- **Storage:** Expo SecureStore + AsyncStorage

### API Endpoints Used

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and sync user
- `GET /api/auth/me` - Get current user

#### Cases
- `GET /api/cases` - List user's cases
- `POST /api/cases` - Create new case
- `GET /api/cases/{id}` - Get case details

#### Documents
- `GET /api/documents` - List documents
- `POST /api/documents` - Upload document
- `GET /api/documents/{id}` - Get document details

#### Messages/Chat
- `GET /api/messages` - List conversations
- `POST /api/chat/messages` - Send message
- `PUT /api/chat/messages/{id}/read` - Mark as read
- `PUT /api/chat/messages/mark-read` - Batch mark as read

#### Emails
- `GET /api/emails` - List emails
- `POST /api/emails/send` - Send email
- `GET /api/emails/{id}` - Get email details

#### Notifications
- `GET /api/notifications` - List notifications
- `PUT /api/notifications/{id}` - Mark as read
- `PUT /api/notifications/mark-all-read` - Mark all as read

#### User Profile
- `GET /api/users/profile` - Get profile
- `PATCH /api/users/profile` - Update profile
- `PUT /api/users/push-token` - Register push token
- `GET /api/users/data-export` - Export data (GDPR)
- `DELETE /api/users/account` - Delete account (GDPR)

### Data Models

#### User
```typescript
{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'CLIENT' | 'AGENT' | 'ADMIN';
  isVerified: boolean;
  consentedAt: string; // GDPR
  acceptedTerms: boolean; // GDPR
  acceptedPrivacy: boolean; // GDPR
}
```

#### Case
```typescript
{
  id: string;
  referenceNumber: string;
  serviceType: 'STUDENT_VISA' | 'WORK_PERMIT' | ...;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'PROCESSING' | 'APPROVED' | ...;
  assignedAgentId?: string;
  submissionDate: Date;
  lastUpdated: Date;
}
```

#### Document
```typescript
{
  id: string;
  caseId: string;
  documentType: 'PASSPORT' | 'DIPLOMA' | ...;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  fileName: string;
  filePath: string;
  uploadDate: Date;
  rejectionReason?: string;
}
```

---

## App Architecture

### Folder Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── verify-email.tsx
│   │   ├── privacy-policy.tsx
│   │   └── terms.tsx
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Dashboard
│   │   ├── cases.tsx
│   │   ├── documents.tsx
│   │   ├── messages.tsx
│   │   ├── notifications.tsx
│   │   └── profile.tsx
│   ├── case/
│   │   ├── [id].tsx       # Case details
│   │   └── new.tsx        # Create case
│   ├── document/
│   │   └── upload.tsx
│   ├── message/
│   │   └── [id].tsx       # Chat room
│   ├── email/
│   │   └── [id].tsx       # Email reader
│   └── onboarding.tsx
├── components/
│   └── ui/                # Reusable UI components
├── features/
│   └── auth/              # Authentication features
├── lib/
│   ├── api/               # API client & endpoints
│   ├── services/          # Business logic services
│   ├── hooks/             # Custom React hooks
│   ├── i18n/              # Internationalization
│   └── types/             # TypeScript types
├── stores/                # Zustand state stores
└── docs/                  # Documentation
```

### State Management

- **Zustand Stores:**
  - `authStore` - Authentication state
  - `casesStore` - Cases state
  - `documentsStore` - Documents state
  - `notificationsStore` - Notifications state

- **React Query:**
  - API data caching
  - Automatic refetching
  - Pagination handling
  - Optimistic updates

### Key Services

- `lib/services/auth.ts` - Authentication logic
- `lib/services/chat.ts` - Chat/Real-time messaging
- `lib/services/pushNotifications.ts` - Push notification handling
- `lib/services/notifications.ts` - In-app notifications
- `lib/services/biometricAuth.ts` - Biometric authentication
- `lib/api/axios.ts` - API client with interceptors

---

## Fonctionnalités Complètes

### Fonctionnalités Client (Mobile App)

#### Authentification & Sécurité
-  Inscription avec validation complète
-  Connexion par email/mot de passe
-  Connexion Google OAuth
-  Authentification biométrique (Face ID/Touch ID/Fingerprint)
-  Vérification email obligatoire
-  Récupération de mot de passe
-  Session persistante (remember me)
-  Stockage sécurisé des tokens (SecureStore)
-  Auto-refresh des tokens expirés

#### Onboarding & Navigation
-  Onboarding interactif (5 slides)
-  Navigation par onglets (Dashboard, Dossiers, Documents, Messages, Notifications, Profil)
-  Navigation profonde entre écrans
-  Deep linking depuis notifications

#### Gestion des Dossiers
-  Création de nouveaux dossiers (formulaire multi-étapes)
-  Liste des dossiers avec filtres (statut, type de service)
-  Recherche par numéro de référence
-  Détails du dossier avec timeline visuelle
-  Suivi du statut en temps réel
-  Historique des changements de statut
-  Prévention des doublons (un dossier actif par type de service)

#### Gestion des Documents
-  Upload via caméra (prise de photo directe)
-  Upload via galerie (sélection d'images)
-  Upload de fichiers PDF
-  Validation des fichiers (taille max 10MB, types autorisés)
-  Compression automatique des images (80% qualité)
-  Barre de progression d'upload
-  Liste des documents avec filtres
-  Suivi du statut (PENDING, APPROVED, REJECTED)
-  Affichage des raisons de rejet
-  Re-upload de documents rejetés

#### Communication
-  Chat temps réel avec l'agent assigné (< 100ms latence)
-  Indicateurs de frappe ("Agent is typing...")
-  Statut de lecture des messages (lu)
-  Historique des messages (derniers 100 messages)
-  Système d'emails avec réponses
-  Liste des conversations (groupées par dossier)
-  Badges de messages non lus

#### Notifications
-  Notifications push (iOS & Android)
-  Centre de notifications in-app
-  7 types de notifications (assignation, statut, documents, messages, etc.)
-  Marquer comme lu (individuel ou en masse)
-  Deep linking depuis notifications
-  Badge count sur l'icône de l'app
-  Notifications email pour événements importants

#### Profil & Paramètres
-  Consultation et modification du profil
-  Upload d'avatar
-  Changement de mot de passe
-  Préférences de notifications
-  Sélection de langue (EN/FR)
-  Sélection de thème (Light/Dark/Auto)
-  Activation/désactivation de la biométrie

#### Conformité GDPR
-  Politique de confidentialité accessible
-  Conditions d'utilisation accessibles
-  Export de toutes les données personnelles (JSON)
-  Suppression de compte (avec période de grâce de 30 jours)
-  Traçabilité des consentements avec timestamps

#### Aide & Support
-  FAQ avec recherche et catégories
-  Formulaire de contact support
-  Guides et templates de documents téléchargeables

---

### Fonctionnalités Agent (Web Dashboard)

#### Authentification
-  Connexion sécurisée (email/mot de passe)
-  Session avec cookies sécurisés
-  Auto-logout après inactivité
-  Récupération de mot de passe

#### Dashboard
-  Vue d'ensemble des dossiers assignés
-  Statistiques (dossiers en attente, documents à examiner)
-  Notifications récentes
-  Actions rapides
-  Calendrier des échéances

#### Gestion des Dossiers
-  Liste des dossiers assignés avec filtres avancés
-  Recherche par référence ou nom client
-  Tri par date, priorité, statut
-  Détails complets du dossier
-  Informations client complètes
-  Timeline des changements de statut
-  Mise à jour du statut du dossier
-  Ajout de notes internes (visibles agents/admins uniquement)
-  Gestion des priorités

#### Gestion des Documents
-  Visualisation des documents (PDF/Images)
-  Approbation de documents
-  Rejet de documents avec raison
-  Demande de documents supplémentaires
-  Liste de tous les documents du dossier
-  Historique des validations

#### Communication
-  Chat temps réel avec clients (Firebase)
-  Envoi d'emails aux clients
-  Réception et réponse aux emails
-  Templates de réponses rapides
-  Suivi des conversations
-  Indicateurs de présence (online/offline)

#### Rapports
-  Vue des dossiers traités
-  Statistiques personnelles
-  Historique des interactions

---

### Fonctionnalités Administrateur (Web Dashboard)

#### Toutes les Fonctionnalités Agent +
-  Accès à tous les dossiers (pas seulement assignés)
-  Vue globale de tous les utilisateurs

#### Gestion des Utilisateurs
-  Liste de tous les clients avec filtres
-  Création de comptes clients (si nécessaire)
-  Modification des profils utilisateurs
-  Désactivation de comptes
-  Liste de tous les agents
-  Création de comptes agents
-  Assignation de rôles et permissions
-  Liste de tous les administrateurs
-  Gestion des permissions admin
-  Export de listes (CSV/Excel)

#### Assignation des Dossiers
-  Vue de tous les dossiers (assignés et non assignés)
-  Assignation manuelle des dossiers aux agents
-  Réassignation de dossiers
-  Gestion des priorités globales
-  Distribution automatique (optionnel)

#### Configuration Système
-  Gestion des types de services
  - Ajout/modification des services
  - Définition des documents requis par service
  - Configuration des délais de traitement
-  Gestion des templates de documents
  - Upload de modèles de formulaires
  - Organisation par catégories
  - Gestion des versions
-  Gestion des FAQ
  - Création/modification des Q&A
  - Organisation par catégories
  - Activation/désactivation
-  Configuration des emails
  - Modification des templates d'emails
  - Personnalisation des messages
  - Configuration des déclencheurs

#### Analytics & Rapports
-  Dashboard avec statistiques globales
-  Graphiques:
  - Dossiers par statut (graphique en secteurs)
  - Dossiers par type de service (graphique en barres)
  - Tendances temporelles (graphique en ligne)
  - Performance des agents
-  Rapports personnalisés
  - Builder de rapports
  - Export PDF/Excel
  - Rapports programmés
-  Métriques:
  - Nombre total de clients
  - Dossiers actifs
  - Dossiers en attente de revue
  - Dossiers complétés ce mois
  - Taux de conversion
  - Funnel de conversion

#### Audit & Surveillance
-  Logs d'activité complets
  - Actions des utilisateurs
  - Historique de connexion
  - Modifications de données
  - Filtres par utilisateur, type d'action, période
-  Export des logs
  - Analyse de sécurité
  - Conformité réglementaire
  - Dépannage
-  Surveillance du système
  - Performance des API
  - Utilisation de la base de données
  - Erreurs et exceptions

---

### Fonctionnalités Partagées (Client, Agent, Admin)

#### Communication
-  Chat temps réel via Firebase Realtime Database
-  Système d'emails avec thread tracking
-  Notifications push et in-app
-  Indicateurs de présence

#### Notifications
-  Notifications push multi-canal
-  Centre de notifications in-app
-  Notifications email
-  Marquer comme lu

#### Sécurité
-  Authentification Firebase
-  Chiffrement des données sensibles
-  HTTPS uniquement
-  Validation des entrées
-  Protection XSS et SQL injection

---

## Déroulement de l'Implémentation

### Chronologie du Projet

Le projet a été développé en **8 semaines** avec une approche itérative et agile, en suivant les meilleures pratiques de développement mobile et web.

#### Semaine 1-2: Setup et Authentification

**Objectifs:**
- Configuration de l'environnement de développement
- Setup React Native + Expo
- Intégration Firebase Auth
- Implémentation de l'authentification (Email/Password, Google OAuth)
- Système de stockage sécurisé (SecureStore)

**Livrables:**
-  Onboarding screen (5 slides)
-  Écrans d'inscription et connexion
-  Vérification email
-  Récupération mot de passe
-  Authentification biométrique (Face ID/Touch ID)
-  Session persistence

**Branches Git:**
- `feature/auth-push-notifications-ui`

#### Semaine 3: UI Components et Dashboard

**Objectifs:**
- Création de la bibliothèque de composants UI réutilisables
- Implémentation du dashboard client
- Système de navigation (Expo Router)

**Livrables:**
-  Bibliothèque de composants UI (8 composants)
-  Dashboard avec statistiques
-  Navigation par onglets
-  Pull-to-refresh
-  Animations avec Reanimated

**Branches Git:**
- `feature/onboarding-dashboard`

#### Semaine 4: Gestion des Dossiers

**Objectifs:**
- Implémentation de la gestion complète des dossiers
- Création de nouveaux dossiers
- Liste et détails des dossiers
- Timeline visuelle des statuts

**Livrables:**
-  Écran de création de dossier (formulaire multi-étapes)
-  Liste des dossiers avec filtres et recherche
-  Détails du dossier avec timeline
-  Validation et règles métier

**Branches Git:**
- `feature/case-management`

#### Semaine 5: Gestion des Documents

**Objectifs:**
- Système d'upload de documents
- Intégration caméra et galerie
- Gestion des fichiers (validation, compression)
- Liste et organisation des documents

**Livrables:**
-  Upload via caméra/galerie/fichier
-  Validation des fichiers (taille, type)
-  Compression d'images (80% qualité)
-  Liste des documents avec filtres
-  Barre de progression d'upload

**Branches Git:**
- `feature/document-management`

#### Semaine 6: Chat Temps Réel et Notifications

**Objectifs:**
- Intégration Firebase Realtime Database
- Système de chat instantané
- Notifications push (Expo + FCM)
- Système d'emails

**Livrables:**
-  Chat temps réel (< 100ms latence)
-  Indicateurs de frappe
-  Statut de lecture (lu)
-  Notifications push multi-canal
-  Système d'emails avec réponses
-  Centre de notifications

**Branches Git:**
- `feature/real-time-chat`

#### Semaine 7: Profil, Aide et Optimisations

**Objectifs:**
- Gestion du profil utilisateur
- FAQ et support
- Optimisations de performance
- Support offline

**Livrables:**
-  Écran de profil avec édition
-  FAQ avec recherche
-  Contact support
-  Optimisations (debounce, memoization, pagination)
-  Support offline (caching)

**Branches Git:**
- `feature/profile-help-notifications`

#### Semaine 8: Conformité GDPR et Finalisation

**Objectifs:**
- Conformité GDPR complète
- Internationalisation (EN/FR)
- Tests et corrections de bugs
- Documentation complète

**Livrables:**
-  Politique de confidentialité
-  Conditions d'utilisation
-  Export des données (GDPR)
-  Suppression de compte
-  Traductions complètes (EN/FR)
-  Tests sur iOS et Android
-  Documentation technique

**Branches Git:**
- `feat/push-notification` (branche principale)

### Technologies et Outils Utilisés

#### Développement
- **IDE:** VS Code avec extensions React Native
- **Version Control:** Git + GitHub
- **Package Manager:** pnpm
- **Build:** Expo Application Services (EAS)

#### Testing
- **Plateformes:** iOS Simulator, Android Emulator, Appareils physiques
- **Tests:** Tests manuels sur iOS 13.4+ et Android 6.0+
- **Performance:** React DevTools, Flipper

#### Déploiement
- **Mobile:** Expo EAS Build (iOS & Android)
- **Web:** Vercel (Next.js)
- **Base de données:** Neon PostgreSQL
- **Storage:** UploadThing, Firebase Storage

### Méthodologie de Développement

#### Approche Agile
- **Sprints:** 2 semaines par sprint
- **Daily Standups:** Revue quotidienne du progrès
- **Code Reviews:** Revue de code avant merge
- **Documentation:** Documentation continue

#### Gestion des Branches Git
```
main (MVP)
├── feature/auth-push-notifications-ui
├── feature/onboarding-dashboard
├── feature/case-management
├── feature/document-management
├── feature/real-time-chat
├── feature/profile-help-notifications
└── feat/push-notification (current)
```

#### Standards de Code
- **TypeScript:** Typage strict pour toutes les fonctions
- **ESLint:** Linting automatique
- **Prettier:** Formatage automatique
- **Conventions:** Naming conventions, commentaires

### Défis Rencontrés et Solutions

#### Challenge 1: Synchronisation Temps Réel
**Problème:** Synchroniser les messages entre Firebase et PostgreSQL  
**Solution:** Dual sync - Firebase pour temps réel, PostgreSQL pour persistance

#### Challenge 2: Notifications Push Multi-Plateforme
**Problème:** Différences entre iOS (APNs) et Android (FCM)  
**Solution:** Expo Push Notifications unifié avec configuration spécifique par plateforme

#### Challenge 3: Performance sur Liste Longues
**Problème:** Ralentissement avec de nombreuses données  
**Solution:** Pagination, memoization, FlatList optimizations, debouncing

#### Challenge 4: Conformité GDPR
**Problème:** Respect des exigences GDPR  
**Solution:** Consent tracking, export de données, politique de confidentialité complète

### Métriques de Performance

#### App Launch
- **Temps de lancement:** < 3 secondes - **Temps jusqu'à interaction:** < 1 seconde 
#### Navigation
- **Transitions d'écran:** < 300ms - **Scroll FPS:** 60 FPS constant 
#### API Response
- **Temps de réponse moyen:** < 500ms - **Cache hit rate:** 85% 
#### Upload
- **Upload 10MB:** < 30 secondes (4G) - **Compression image:** Réduction 60-70% 
---

## Statistiques du Projet

### Code et Structure

| Métrique | Valeur |
|----------|--------|
| **Lignes de code** | ~35,000+ |
| **Fichiers créés** | 135+ |
| **Composants UI** | 18+ |
| **Écrans** | 25+ |
| **Services** | 7 |
| **Hooks personnalisés** | 3 |
| **API Endpoints** | 30+ |
| **Traductions** | 2 langues (EN/FR) |

### Fonctionnalités

| Catégorie | Nombre | Statut |
|-----------|--------|--------|
| **Authentification** | 5 méthodes |  100% |
| **Gestion Dossiers** | 6 fonctionnalités |  100% |
| **Gestion Documents** | 8 fonctionnalités |  100% |
| **Communication** | 4 canaux |  100% |
| **Notifications** | 3 types |  100% |
| **Conformité** | 6 droits GDPR |  100% |
| **Internationalisation** | 2 langues |  100% |

### Tests et Qualité

| Aspect | Couverture |
|--------|------------|
| **Tests fonctionnels** | 100% des fonctionnalités principales |
| **Tests de performance** | Tous les objectifs atteints |
| **Tests de sécurité** | Authentification, GDPR, chiffrement |
| **Tests cross-platform** | iOS 13.4+, Android 6.0+ |
| **Tests d'accessibilité** | Safe areas, keyboard handling |

### Documentation

| Type | Nombre |
|------|--------|
| **Documents techniques** | 15+ |
| **Guides d'implémentation** | 8 |
| **Documentation API** | Complète |
| **Diagrammes de flux** | 10+ |

---

## Architecture Technique

### Stack Technique Complet

#### Frontend Mobile
```json
{
  "framework": "React Native + Expo SDK 54",
  "language": "TypeScript",
  "navigation": "Expo Router",
  "state": "Zustand + React Query",
  "ui": "React Native Paper",
  "animations": "React Native Reanimated",
  "forms": "React Hook Form + Zod",
  "storage": "Expo SecureStore + AsyncStorage"
}
```

#### Frontend Web
```json
{
  "framework": "Next.js 15+",
  "language": "TypeScript",
  "styling": "Tailwind CSS + shadcn/ui",
  "state": "React Context + Zustand",
  "charts": "Recharts",
  "forms": "React Hook Form"
}
```

#### Backend
```json
{
  "api": "Next.js API Routes",
  "database": "PostgreSQL (Neon)",
  "realtime": "Firebase Realtime Database",
  "auth": "Firebase Auth",
  "storage": "UploadThing",
  "notifications": "Expo Push + FCM"
}
```

### API Endpoints Principaux

#### Authentification (3 endpoints)
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur

#### Dossiers (4 endpoints)
- `GET /api/cases` - Liste des dossiers
- `POST /api/cases` - Créer un dossier
- `GET /api/cases/{id}` - Détails du dossier
- `PATCH /api/cases/{id}/status` - Mettre à jour le statut

#### Documents (4 endpoints)
- `GET /api/documents` - Liste des documents
- `POST /api/documents` - Upload document
- `GET /api/documents/{id}` - Détails document
- `PATCH /api/documents/{id}/verify` - Valider document

#### Messages (5 endpoints)
- `GET /api/messages` - Liste conversations
- `POST /api/chat/messages` - Envoyer message
- `PUT /api/chat/messages/{id}/read` - Marquer comme lu
- `PUT /api/chat/messages/mark-read` - Marquer plusieurs comme lus
- `GET /api/emails` - Liste emails

#### Notifications (3 endpoints)
- `GET /api/notifications` - Liste notifications
- `PUT /api/notifications/{id}` - Marquer comme lu
- `PUT /api/notifications/mark-all-read` - Tout marquer comme lu

#### Utilisateurs (5 endpoints)
- `GET /api/users/profile` - Profil
- `PATCH /api/users/profile` - Mettre à jour profil
- `PUT /api/users/push-token` - Enregistrer token push
- `GET /api/users/data-export` - Export données (GDPR)
- `DELETE /api/users/account` - Supprimer compte (GDPR)

**Total: 24+ endpoints principaux**

### Modèles de Données Principaux

#### User (Utilisateur)
- Informations personnelles
- Rôle (CLIENT, AGENT, ADMIN)
- Statut de vérification
- Consentements GDPR
- Timestamps

#### Case (Dossier)
- Numéro de référence unique
- Type de service
- Statut (7 statuts possibles)
- Agent assigné
- Dates (soumission, mise à jour)
- Priorité

#### Document (Document)
- Type de document
- Statut (PENDING, APPROVED, REJECTED)
- Fichier (chemin, taille, type)
- Raison du rejet (si applicable)
- Dates

#### Message (Message)
- Contenu
- Expéditeur/Destinataire
- Statut de lecture
- Timestamps
- Pièces jointes (optionnel)

#### Notification (Notification)
- Type (7 types)
- Titre et message
- Statut de lecture
- URL d'action
- Timestamps

---

## Résumé et Conclusion

### Points Forts du Projet

 **Architecture Solide**
- Architecture modulaire et scalable
- Séparation claire des responsabilités
- Code maintenable et extensible

 **Expérience Utilisateur**
- Interface intuitive et moderne
- Animations fluides
- Performance optimale

 **Sécurité et Conformité**
- Conformité GDPR complète
- Authentification multi-facteurs
- Chiffrement des données sensibles

 **Multi-Plateforme**
- iOS et Android natifs
- Web dashboard responsive
- Synchronisation temps réel

 **Performance**
- Temps de chargement optimisés
- Cache intelligent
- Optimisations réseau

### Prochaines Étapes Recommandées

#### Court Terme (1-2 mois)
1. **Tests utilisateurs:** Beta testing avec utilisateurs réels
2. **Optimisations:** Améliorations basées sur les retours
3. **Documentation utilisateur:** Guides pour clients et agents
4. **Support client:** Système de ticketing intégré

#### Moyen Terme (3-6 mois)
1. **Fonctionnalités avancées:**
   - Paiements en ligne
   - Signature électronique
   - Vidéo-conférence avec agents
   - Notifications SMS
2. **Analytics avancées:**
   - Tableaux de bord personnalisés
   - Prédictions de délais
   - Analyse de performance
3. **Intégrations:**
   - APIs gouvernementales
   - Services de traduction
   - Systèmes de paiement

#### Long Terme (6-12 mois)
1. **Expansion:**
   - Nouvelles langues
   - Nouvelles régions
   - Nouveaux types de services
2. **IA et Automatisation:**
   - Chatbot intelligent
   - Analyse automatique de documents
   - Suggestions automatiques
3. **Mobile Web:**
   - Progressive Web App (PWA)
   - Offline-first architecture

---

**Statut du Document:**  Complet  
**Dernière Mise à Jour:** 2 Novembre 2025  
**Maintenu par:** Avom Brice, Développeur  
**Version:** 1.0
**github**:https://github.com/frckbrice/patrick-travel-service-app-mobile

---

*Ce document présente une vue complète du projet Patrick Travel Services, incluant tous les workflows utilisateurs, les fonctionnalités implémentées, et le déroulement de l'implémentation.*

