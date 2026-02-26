import redis 
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
x=2
redis_client.set(f"test_key{x}", "test_value")
print(redis_client.get(f"test_key{x}"))