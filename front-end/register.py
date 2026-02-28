async def handle_google_callback(google_data):
    # 1. Extract the unique Google ID (sub)
    google_id = google_data['sub']
    email = google_data['email']

    # 2. Check if this Google user already exists in our identities table
    identity = db.query(UserIdentity).filter_by(provider_user_id=google_id).first()

    if not identity:
        # --- START SIGN UP FLOW ---
        # Create the core user first
        new_user = User(email=email)
        db.add(new_user)
        db.flush() # Get the new_user.user_id

        # Create the identity link
        new_identity = UserIdentity(
            user_id=new_user.user_id,
            provider='google',
            provider_user_id=google_id,
            refresh_token=google_data.get('refresh_token') # Essential for passive data
        )
        db.add(new_identity)
        
        # Create the empty profile for the ML model to eventually fill
        new_profile = StudentProfile(user_id=new_user.user_id)
        db.add(new_profile)
        db.commit()
        return {"status": "signed_up", "user_id": new_user.user_id}

    else:
        # --- START LOGIN FLOW ---
        identity.last_login = datetime.utcnow()
        db.commit()
        return {"status": "logged_in", "user_id": identity.user_id}