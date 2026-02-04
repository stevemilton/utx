/**
 * UTx Centralized Copy/Strings File
 *
 * All user-facing text in the app should be defined here.
 * This enables:
 * - Easy review and editing of all copy in one place
 * - Future localization (i18n) support
 * - Consistent terminology across the app
 *
 * Usage: import { strings } from '../constants/strings';
 *        <Text>{strings.common.cancel}</Text>
 */

export const strings = {
  // ═══════════════════════════════════════════════════════════════════════════
  // BRAND & APP INFO
  // ═══════════════════════════════════════════════════════════════════════════
  brand: {
    name: 'UTx',
    tagline: 'Every ERG Counts',
    version: 'Version 1.0.0',
    description: 'Turn your erg screen photos into structured training data with AI-powered analysis.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMON / SHARED STRINGS
  // ═══════════════════════════════════════════════════════════════════════════
  common: {
    // Actions
    cancel: 'Cancel',
    save: 'Save',
    done: 'Done',
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    submit: 'Submit',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    join: 'Join',
    leave: 'Leave',
    copy: 'Copy',
    approve: 'Approve',
    reject: 'Reject',
    confirm: 'Confirm',
    tryAgain: 'Try Again',

    // Status
    loading: 'Loading...',
    saving: 'Saving...',
    sending: 'Sending...',
    connected: 'Connected',
    connect: 'Connect',
    disconnect: 'Disconnect',
    requested: 'Requested',
    pending: 'Pending',

    // Labels
    email: 'Email',
    password: 'Password',
    name: 'Name',
    distance: 'Distance',
    time: 'Time',
    split: 'Split',
    members: 'Members',
    workouts: 'Workouts',
    followers: 'Followers',
    following: 'Following',

    // Errors
    error: 'Error',
    errorGeneric: 'Something went wrong. Please try again.',
    errorNetwork: 'Network error. Please check your connection.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════
  auth: {
    welcome: {
      tagline: 'Every ERG Counts',
      description: 'Turn your erg screen photos into structured training data with AI-powered analysis.',
      signUp: 'Sign Up',
      logIn: 'Log In',
    },

    login: {
      title: 'Welcome back',
      subtitle: 'Log in with your email',
      emailLabel: 'Email',
      emailPlaceholder: 'Enter your email',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter your password',
      forgotPassword: 'Forgot password?',
      loginButton: 'Log In',
      noAccount: "Don't have an account? ",
      signUpLink: 'Sign up',

      // Errors
      invalidCredentials: 'Invalid email or password',
      emailNotVerified: 'Email Not Verified',
      emailNotVerifiedMessage: 'Please verify your email before logging in. Check your inbox for the verification link.',
      resendEmail: 'Resend Email',
    },

    signup: {
      title: 'Create your account',
      subtitle: 'Sign up with your email address',
      nameLabel: 'Name',
      namePlaceholder: 'Enter your name',
      emailLabel: 'Email',
      emailPlaceholder: 'Enter your email',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Create a password',
      confirmPasswordLabel: 'Confirm Password',
      confirmPasswordPlaceholder: 'Confirm your password',
      signUpButton: 'Sign Up',
      hasAccount: 'Already have an account? ',
      logInLink: 'Log in',

      // Password requirements
      requirements: {
        minLength: 'At least 8 characters',
        uppercase: 'One uppercase letter',
        lowercase: 'One lowercase letter',
        number: 'One number',
      },

      // Terms
      termsPrefix: 'By signing up, you agree to our ',
      termsOfService: 'Terms of Service',
      and: ' and ',
      privacyPolicy: 'Privacy Policy',

      // Errors
      registrationFailed: 'Registration Failed',
    },

    forgotPassword: {
      title: 'Reset password',
      subtitle: "Enter your email address and we'll send you a link to reset your password.",
      sendButton: 'Send Reset Link',
      rememberPassword: 'Remember your password? ',
      logInLink: 'Log in',

      // Success
      successTitle: 'Check your email',
      successMessage: 'If an account exists for {email}, you will receive a password reset link shortly.',
      successInstructions: "The link will expire in 1 hour. If you don't see the email, check your spam folder.",
      backToLogin: 'Back to Login',
      tryDifferentEmail: 'Try a different email',
    },

    verifyEmail: {
      title: 'Check your email',
      subtitle: "We've sent a verification link to",
      instructions: 'Click the link in the email to verify your account and complete registration.',
      openEmailApp: 'Open Email App',
      resendPrompt: "Didn't receive the email? Resend",
      resendCooldown: 'Resend email in {seconds}s',
      useDifferentEmail: 'Use a different email',
      alreadyVerified: 'Already verified your email?',
      logInHere: 'Log in here',
      spamHint: "Check your spam folder if you don't see the email in your inbox.",

      // Success
      emailSent: 'Email Sent',
      emailSentMessage: 'A new verification email has been sent.',
    },

    resetPassword: {
      title: 'Reset Password',
      subtitle: "We'll send a password reset link to:",
      sendButton: 'Send Reset Link',
      successTitle: 'Reset link sent!',
      successMessage: 'Check your email and follow the link to reset your password.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ONBOARDING
  // ═══════════════════════════════════════════════════════════════════════════
  onboarding: {
    progress: '{current} of {total}',

    tutorial: {
      title: 'Quick Tutorial',
      skipButton: 'Skip Tutorial',
      getStarted: 'Get Started',

      slides: [
        {
          title: 'Snap your workout data',
          description: 'After your workout, take a photo of your erg screen. UTx handles the rest.',
        },
        {
          title: 'We do the rest',
          description: 'Our AI reads the data from your photo - time, distance, splits, heart rate, everything.',
        },
        {
          title: 'Track your progress',
          description: 'See your PBs, get coaching insights, and compare with your squad.',
        },
      ],
    },

    consent: {
      title: 'Before we start',
      termsLabel: 'Terms & Conditions',
      termsDescription: 'I accept the Terms and Conditions',
      privacyLabel: 'Privacy Policy',
      privacyDescription: 'I accept the Privacy Policy',
      marketingLabel: 'Marketing',
      marketingDescription: 'Send me tips, news, and special offers',
      analyticsLabel: 'Analytics',
      analyticsDescription: 'Help improve UTx by sharing anonymous usage data',
      coachLabel: 'Coach Sharing',
      coachDescription: 'Allow my coach to view my workout data',
    },

    profile: {
      identity: {
        title: 'Your Profile',
        displayNameLabel: 'Display Name',
        displayNamePlaceholder: 'How should we call you?',
        genderLabel: 'Gender',
        dobLabel: 'Date of Birth',
      },
      physical: {
        title: 'Physical Stats',
        heightLabel: 'Height (cm)',
        weightLabel: 'Weight (kg)',
      },
    },

    heartRate: {
      title: 'Heart Rate Setup',
      maxHrQuestion: 'Do you know your maximum heart rate?',
      yesKnown: 'Yes, I know my max HR',
      noEstimate: 'No, estimate for me',
      maxHrLabel: 'Enter your tested max HR',
      estimatedLabel: 'Estimated Max HR',
      restingHrLabel: 'Resting HR (Good for accurate data)',
    },

    joinClub: {
      title: 'Join a Club',
      searchPlaceholder: 'Search for your club...',
      inviteCodeLabel: 'Or enter invite code',
      inviteCodePlaceholder: 'Enter club invite code',
      skipForNow: 'Skip for now',
      cantFindClub: "Can't find your club?",
      createClubLink: 'Request to create a club',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN SCREENS
  // ═══════════════════════════════════════════════════════════════════════════
  feed: {
    title: 'Feed',
    filters: {
      all: 'All',
      squad: 'Squad',
      following: 'Following',
    },
    empty: {
      title: 'No workouts yet',
      allMessage: 'Add your first workout or follow other rowers to see their sessions',
      squadMessage: 'Join a squad to see workouts from your teammates',
      followingMessage: 'Follow other rowers to see their workouts',
    },
  },

  workouts: {
    title: 'My Workouts',
    totalDistance: 'Total Distance',
    totalTime: 'Total Time',
    empty: {
      title: 'No workouts yet',
      message: 'Tap the + button to log your first workout',
    },
    calendar: {
      noWorkoutsThisMonth: 'No workouts this month',
    },
  },

  addWorkout: {
    title: 'Add Workout',
    subtitle: 'Take a photo of your erg screen or enter data manually',

    options: {
      takePhoto: 'Take Photo',
      takePhotoDescription: 'Coming soon',
      chooseGallery: 'Choose from Gallery',
      chooseGalleryDescription: 'Upload a photo from your camera roll',
      manualEntry: 'Manual Entry',
      manualEntryDescription: 'Type in your workout data yourself',
    },

    form: {
      title: 'Workout Details',
      workoutType: 'Workout Type',
      distance: 'Distance (metres)',
      distanceEstimated: '(estimated)',
      distancePlaceholder: 'e.g., 2000',
      time: 'Time (m:ss.s)',
      timePlaceholder: 'e.g., 7:23.4',
      avgSplit: 'Average Split (m:ss.s / 500m)',
      avgSplitPlaceholder: 'e.g., 1:51.2',
      strokeRate: 'Stroke Rate',
      strokeRatePlaceholder: 'e.g., 28',
      watts: 'Watts',
      wattsPlaceholder: 'e.g., 250',
      heartRate: 'Heart Rate',
      heartRatePlaceholder: 'e.g., 165',
      calories: 'Calories',
      caloriesPlaceholder: 'e.g., 150',
      dragFactor: 'Drag Factor',
      dragFactorPlaceholder: 'e.g., 120',
      notes: 'Notes (optional)',
      notesPlaceholder: 'How did it feel? Any notes about the workout...',
      saveButton: 'Save Workout',

      // Privacy
      publicLabel: 'Public',
      publicDescription: 'Visible on the public feed and leaderboards',
      privateLabel: 'Private',
      privateDescription: 'Only visible on your personal workouts list',

      // Machine types
      machineTypes: {
        row: 'Row',
        bike: 'Bike',
        ski: 'Ski',
      },

      // Workout types
      workoutTypes: {
        distance: 'Distance',
        time: 'Time',
        intervals: 'Intervals',
      },
    },

    processing: {
      messages: [
        'Reading erg screen...',
        'Paddling...',
        'Erging...',
        'Stretching...',
        'Settling...',
        'Please wait...',
        'Can take 20 seconds...',
      ],
    },

    tips: {
      title: 'Tips for best results',
      items: [
        'Make sure the entire screen is visible in the photo',
        'Avoid glare and reflections on the screen',
        'Works best with PM5, but PM3 and PM4 are supported too',
      ],
    },

    validation: {
      missingData: 'Missing Data',
      missingDataMessage: 'Please enter at least time and distance.',
      timeShort: 'Time seems very short. Did you enter the split by mistake?',
      splitSlow: 'Split seems very slow (over 4:00/500m). Is this correct?',
      splitFast: 'Split seems very fast (under 1:10/500m). Is this correct?',
      splitLongerThanTime: 'Split cannot be longer than total time. These may be swapped.',
      distanceMismatch: "Distance doesn't match time/split. Expected ~{expected}m",
      strokeRateUnusual: 'Stroke rate seems unusual (typically 18-38 s/m)',
      heartRateUnusual: 'Heart rate seems unusual',
      reviewTitle: 'Please review:',
    },

    ocr: {
      lowConfidence: 'Low Confidence',
      lowConfidenceMessage: 'The OCR reading has low confidence. Please verify the data is correct.',
      ocrFailed: 'OCR Failed',
      ocrFailedMessage: 'Could not read the erg screen. Would you like to enter the data manually?',
      enterManually: 'Enter Manually',
      confidenceLabel: 'OCR Confidence:',
      verifyData: ' - Please verify data',
    },

    alerts: {
      photoPermission: 'Photo Library Permission',
      photoPermissionMessage: 'UTx needs access to your photos to upload erg screen images.',
      success: 'Success',
      successMessage: 'Workout saved!',
      errorSave: 'Failed to save workout. Please try again.',
    },
  },

  leaderboard: {
    title: 'Leaderboard',
    scopes: {
      global: 'Global',
      club: 'Club',
      squad: 'Squad',
      following: 'Following',
    },
    metrics: {
      totalMetresMonthly: 'Monthly Metres',
      best2k: '2K Best',
      best5k: '5K Best',
      best10k: '10K Best',
    },
    empty: {
      title: 'No data yet',
      globalMessage: 'Be the first to set a record!',
      clubMessage: 'Join a club to see club leaderboards',
      squadMessage: 'Join a squad to see squad leaderboards',
      followingMessage: 'Follow other rowers to compete',
    },
    you: '(You)',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE
  // ═══════════════════════════════════════════════════════════════════════════
  profile: {
    title: 'Profile',
    editProfile: 'Edit profile',
    findAthletes: 'Find Athletes',
    height: 'Height',
    weight: 'Weight',
    maxHr: 'Max HR',

    clubs: {
      title: 'Clubs',
      add: '+ Add',
      joinClub: 'Join a club',
      joinClubDescription: 'Connect with your rowing club for squad workouts and leaderboards',
    },

    connections: {
      title: 'Connections',
      strava: 'Strava',
      stravaConnected: 'Connected',
      stravaNotConnected: 'Connect to sync workouts',
    },

    notifications: {
      title: 'Notifications',
      push: 'Push Notifications',
      pushDescription: 'Reactions, comments, club activity',
      email: 'Email Notifications',
      emailDescription: 'Weekly summary, PB alerts',
    },

    support: {
      title: 'Support',
      helpFaq: 'Help & FAQ',
      contactSupport: 'Contact Support',
      resetPassword: 'Reset Password',
      privacySettings: 'Privacy Settings',
      privacySettingsDescription: 'Manage your data preferences',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
    },

    admin: {
      title: 'Admin',
      adminPanel: 'Admin Panel',
      adminPanelDescription: 'Manage club verifications',
    },

    account: {
      title: 'Account',
      logOut: 'Log Out',
      deleteAccount: 'Delete Account',
    },

    alerts: {
      disconnectStrava: 'Disconnect Strava',
      disconnectStravaMessage: 'Are you sure you want to disconnect your Strava account?',
      logOut: 'Log Out',
      logOutMessage: 'Are you sure you want to log out?',
      deleteAccount: 'Delete Account',
      deleteAccountMessage: 'Are you sure you want to delete your account? This action cannot be undone.',
      confirmDeletion: 'Confirm Deletion',
      confirmDeletionMessage: 'Type DELETE to confirm account deletion',
      errorStrava: 'Failed to connect to Strava',
    },

    clubSearch: {
      title: 'Join a Club',
      searchPlaceholder: 'Search for your club...',
      noResults: 'No clubs found',
      createClubLink: 'Request to create a club',
      searchHelp: 'Search for your rowing club to join and see squad workouts',
      requestSent: 'Request Sent!',
      requestSentMessage: "Your request to join {clubName} has been submitted. You'll be notified when approved.",
      alreadyMember: 'Already a Member',
      alreadyMemberMessage: "You're already a member of {clubName}!",
      requestPending: 'Request Pending',
      requestPendingMessage: 'You already have a pending request for {clubName}.',
    },

    resetPasswordModal: {
      title: 'Reset Password',
      subtitle: "We'll send a password reset link to:",
      sendButton: 'Send Reset Link',
      successTitle: 'Reset link sent!',
      successMessage: 'Check your email and follow the link to reset your password.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLUBS
  // ═══════════════════════════════════════════════════════════════════════════
  clubs: {
    detail: {
      clubNotFound: 'Club not found',
      inviteCode: 'Invite Code',
      inviteCodeCopied: 'Copied!',
      inviteCodeCopiedMessage: 'Invite code copied to clipboard',
      pendingRequests: 'Pending Requests',
      topMembers: 'Top Members',
      allMembers: 'All Members',
      noMembers: 'No members yet',

      actions: {
        joinClub: 'Join Club',
        leaveClub: 'Leave Club',
        cancelRequest: 'Cancel Request',
        requestPending: 'Request Pending',
      },

      settings: {
        title: 'Club Settings',
        editDetails: 'Edit Club Details',
        regenerateCode: 'Regenerate Invite Code',
        deleteClub: 'Delete Club',
      },
    },

    squads: {
      title: 'Squads',
      createSquad: 'Create Squad',
      noSquads: 'No squads yet',
      noSquadsHint: 'Create squads to organize your athletes',
      squadNameLabel: 'Squad Name',
      squadNamePlaceholder: "e.g., Men's 1st VIII, Women's U19, Masters",
      squadHelpText: 'Squads help organize athletes within your club by team, age group, or training level.',
      joinSquad: 'Join Squad',
      leaveSquad: 'Leave Squad',
      leaveSquadConfirm: 'Are you sure you want to leave {squadName}?',
      squadCreated: 'Squad "{squadName}" created!',
      joinedSquad: "You're now a member of {squadName}",
    },

    members: {
      viewProfile: 'View Profile',
      makeAdmin: 'Make Admin',
      removeAdminRole: 'Remove Admin Role',
      removeFromClub: 'Remove from Club',
      removeConfirm: 'Remove {memberName}?',
      removeConfirmMessage: 'Are you sure you want to remove this member from the club?',
      adminBadge: 'Admin',
      adminLimit: 'Maximum 3 admins reached',
      adminsCount: '{count}/3 Admins',
    },

    create: {
      title: 'Create a Club',
      nameLabel: 'Club Name',
      namePlaceholder: 'Enter club name',
      locationLabel: 'Location',
      locationPlaceholder: 'City, Country',
      submitButton: 'Submit for Approval',
      successTitle: 'Club Submitted!',
      successMessage: 'Your club request has been submitted for verification. You will receive an email once approved.',
    },

    search: {
      title: 'Find a Club',
      searchPlaceholder: 'Search for your club...',
      enterInviteCode: 'Enter Invite Code',
      inviteCodePlaceholder: 'Enter club invite code',
      noResults: 'No clubs found',
      searchHint: 'Enter at least 2 characters to search',
    },

    alerts: {
      leaveClub: 'Leave Club',
      leaveClubMessage: 'Are you sure you want to leave this club?',
      deleteClub: 'Delete Club',
      deleteClubMessage: 'Are you sure you want to delete this club? This cannot be undone.',
      regenerateCode: 'Regenerate Invite Code',
      regenerateCodeMessage: 'This will invalidate the current invite code. Are you sure?',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SQUADS
  // ═══════════════════════════════════════════════════════════════════════════
  squads: {
    detail: {
      title: 'Squad',
      squadNotFound: 'Squad not found',
      members: 'Members',
      noMembers: 'No members yet',
      beFirstToJoin: 'Be the first to join!',
      captainBadge: 'Captain',
      joinClubNotice: 'Join {clubName} to become a member of this squad',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // USER PROFILE (Other users)
  // ═══════════════════════════════════════════════════════════════════════════
  userProfile: {
    title: 'Profile',
    profileNotFound: 'Profile not found',
    follow: 'Follow',
    following: 'Following',
    totalDistance: 'Total Distance',
    personalBests: 'Personal Bests',

    privateProfile: {
      title: 'This Profile is Private',
      message: 'This user has chosen to keep their profile private.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKOUT TYPES (Display names)
  // ═══════════════════════════════════════════════════════════════════════════
  workoutTypes: {
    five_hundred: '500m',
    one_thousand: '1K',
    two_thousand: '2K Test',
    five_thousand: '5K',
    six_thousand: '6K',
    ten_thousand: '10K',
    half_marathon: 'Half Marathon',
    marathon: 'Marathon',
    one_minute: '1 Min Test',
    steady_state: 'Steady State',
    intervals: 'Intervals',
    custom: 'Workout',
    // Legacy formats
    '500m': '500m',
    '1000m': '1K',
    '2000m': '2K Test',
    '5000m': '5K',
    '6000m': '6K',
    '10000m': '10K',
    '1_minute': '1 Min Test',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATHLETE SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  athleteSearch: {
    title: 'Find Athletes',
    searchPlaceholder: 'Search by name...',
    searchHint: 'Enter at least 2 characters to search',
    noResults: 'No athletes found',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  comments: {
    title: 'Comments',
    empty: 'Be the first to comment!',
    placeholder: 'Add a comment...',
    postButton: 'Post',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKOUT DETAIL
  // ═══════════════════════════════════════════════════════════════════════════
  workoutDetail: {
    title: 'Workout',
    workoutNotFound: 'Workout not found',
    pbBadge: 'PB',
    additionalStats: 'Additional Stats',
    avgBpm: 'Avg BPM',
    avgPower: 'Avg Power',
    avgSplit: 'Avg Split',
    dragFactor: 'Drag Factor',

    effortBreakdown: {
      title: 'Effort Breakdown',
      cardiacLoad: 'Cardiac Load:',
      economy: 'Economy:',
      efficiency: 'Efficiency:',
      drift: 'Cardiac Drift',
    },

    actions: {
      edit: 'Edit Workout',
      delete: 'Delete Workout',
      share: 'Share',
    },

    alerts: {
      deleteConfirm: 'Delete Workout',
      deleteConfirmMessage: 'Are you sure you want to delete this workout? This cannot be undone.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMERA / OCR
  // ═══════════════════════════════════════════════════════════════════════════
  camera: {
    title: 'Capture Erg Screen',
    instruction: 'Align the erg screen within the frame',
    cameraPermission: 'Camera Access Required',
    cameraPermissionMessage: 'UTx needs access to your camera to capture erg screen photos.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVACY SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  privacySettings: {
    title: 'Privacy Settings',
    profileVisibility: 'Profile Visibility',
    publicProfile: 'Public Profile',
    publicProfileDescription: 'Others can see your workouts and stats',
    privateProfile: 'Private Profile',
    privateProfileDescription: 'Only you can see your workouts and stats',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION MESSAGES (from utils/validation.ts)
  // ═══════════════════════════════════════════════════════════════════════════
  validation: {
    email: {
      required: 'Email is required',
      invalid: 'Please enter a valid email address',
    },
    password: {
      required: 'Password is required',
      minLength: 'Password must be at least 8 characters',
      uppercase: 'Password must contain at least one uppercase letter',
      lowercase: 'Password must contain at least one lowercase letter',
      number: 'Password must contain at least one number',
    },
    confirmPassword: {
      required: 'Please confirm your password',
      mismatch: 'Passwords do not match',
    },
    name: {
      required: 'Name is required',
      minLength: 'Name must be at least 2 characters',
    },
  },
};

// Type helper for accessing nested strings
export type StringsType = typeof strings;
