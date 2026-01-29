### To modiy
- update lexical search with ngram strategy => add hidden token on every post for search
- update profile endpoint to use graphql and gzip compression instead of rest
- For the match percentage, we will use Min-Max Scaling on the RRF scores. Since RRF scores are naturally very small, scaling them relative to the top result in the set makes them meaningful (e.g., the best match is always 100%).

edge case on signup otp
user hit multiple time now we have in otp collection one email associated with multiple otps