from py_vapid import Vapid
import base64

try:
    vapid = Vapid.from_file("private_key.pem")
    
    # Extract public key as base64 URL safe string
    public_key = vapid.public_key.to_b64()
    if isinstance(public_key, bytes):
        public_key = public_key.decode('utf-8')
        
    print("VAPID_PUBLIC_KEY=" + public_key)
    
    # Extract private key
    private_key = vapid.sign_key.to_b64()
    if isinstance(private_key, bytes):
        private_key = private_key.decode('utf-8')
        
    print("VAPID_PRIVATE_KEY=" + private_key)
except Exception as e:
    print("Error:", e)
