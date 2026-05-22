from py_vapid import Vapid
from cryptography.hazmat.primitives import serialization
import base64

vapid = Vapid.from_file("private_key.pem")

# ECPublicKey serialization to uncompressed X9.62 format (65 bytes)
pub_key = vapid.public_key
raw_pub = pub_key.public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint
)
print("Raw public key length:", len(raw_pub))
pub_b64 = base64.urlsafe_b64encode(raw_pub).decode('utf-8').rstrip('=')
print("VAPID_PUBLIC_KEY=" + pub_b64)

# ECPrivateKey serialization to raw private bytes (32 bytes)
priv_key = vapid.private_key
raw_priv = priv_key.private_numbers().private_value.to_bytes(32, 'big')
print("Raw private key length:", len(raw_priv))
priv_b64 = base64.urlsafe_b64encode(raw_priv).decode('utf-8').rstrip('=')
print("VAPID_PRIVATE_KEY=" + priv_b64)
