"""
Simple in-memory rate limiter for API endpoints.

Implements a sliding window rate limiter to protect against abuse of the
ingestion endpoint. Uses client IP address as the key for rate limiting.
"""

import time
from collections import defaultdict, deque
from typing import Dict, Deque
from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """
    Sliding window rate limiter implementation.
    
    Tracks requests per client IP in a sliding time window and enforces
    configurable rate limits.
    """
    
    def __init__(self, max_requests: int, window_seconds: int = 60):
        """
        Initialize rate limiter.
        
        Args:
            max_requests: Maximum requests allowed per window
            window_seconds: Time window in seconds (default: 60)
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # Store request timestamps per client IP
        self.requests: Dict[str, Deque[float]] = defaultdict(deque)
    
    def is_allowed(self, client_ip: str) -> bool:
        """
        Check if a request from the given IP is allowed.
        
        Args:
            client_ip: Client IP address
            
        Returns:
            True if request is allowed, False if rate limited
        """
        now = time.time()
        window_start = now - self.window_seconds
        
        # Get request history for this IP
        ip_requests = self.requests[client_ip]
        
        # Remove old requests outside the window
        while ip_requests and ip_requests[0] < window_start:
            ip_requests.popleft()
        
        # Check if we're under the limit
        if len(ip_requests) >= self.max_requests:
            return False
        
        # Add current request timestamp
        ip_requests.append(now)
        return True
    
    def get_remaining_requests(self, client_ip: str) -> int:
        """
        Get number of remaining requests for the given IP.
        
        Args:
            client_ip: Client IP address
            
        Returns:
            Number of requests remaining in current window
        """
        now = time.time()
        window_start = now - self.window_seconds
        
        # Get request history for this IP
        ip_requests = self.requests[client_ip]
        
        # Remove old requests outside the window
        while ip_requests and ip_requests[0] < window_start:
            ip_requests.popleft()
        
        return max(0, self.max_requests - len(ip_requests))
    
    def cleanup_old_entries(self):
        """
        Clean up old entries to prevent memory leaks.
        
        Should be called periodically to remove stale IP entries.
        """
        now = time.time()
        window_start = now - self.window_seconds
        
        # Remove IPs with no recent requests
        ips_to_remove = []
        for ip, requests in self.requests.items():
            # Remove old requests
            while requests and requests[0] < window_start:
                requests.popleft()
            
            # If no requests remain, mark IP for removal
            if not requests:
                ips_to_remove.append(ip)
        
        # Remove empty IP entries
        for ip in ips_to_remove:
            del self.requests[ip]


# Global rate limiter instance
_rate_limiter: SlidingWindowRateLimiter | None = None


def get_rate_limiter(max_requests: int) -> SlidingWindowRateLimiter:
    """
    Get or create the global rate limiter instance.
    
    Args:
        max_requests: Maximum requests per minute
        
    Returns:
        Rate limiter instance
    """
    global _rate_limiter
    if _rate_limiter is None or _rate_limiter.max_requests != max_requests:
        _rate_limiter = SlidingWindowRateLimiter(max_requests, window_seconds=60)
    return _rate_limiter


def get_client_ip(request: Request) -> str:
    """
    Extract client IP address from request.
    
    Handles X-Forwarded-For header for proxy scenarios while defaulting
    to direct connection IP.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Client IP address as string
    """
    # Check X-Forwarded-For header first (for proxy scenarios)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain
        return forwarded_for.split(",")[0].strip()
    
    # Check X-Real-IP header (nginx proxy)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    
    # Fall back to direct connection IP
    if request.client:
        return request.client.host
    
    # Default fallback
    return "unknown"


def check_rate_limit(request: Request, max_requests: int) -> None:
    """
    Check rate limit for the current request and raise HTTPException if exceeded.
    
    Args:
        request: FastAPI request object
        max_requests: Maximum requests allowed per minute
        
    Raises:
        HTTPException: 429 Too Many Requests if rate limit exceeded
    """
    client_ip = get_client_ip(request)
    rate_limiter = get_rate_limiter(max_requests)
    
    if not rate_limiter.is_allowed(client_ip):
        remaining = rate_limiter.get_remaining_requests(client_ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {max_requests} requests per minute allowed.",
            headers={
                "X-RateLimit-Limit": str(max_requests),
                "X-RateLimit-Remaining": str(remaining),
                "X-RateLimit-Reset": str(int(time.time() + 60)),
                "Retry-After": "60"
            }
        )


def rate_limit_dependency(max_requests: int):
    """
    Create a FastAPI dependency for rate limiting.
    
    Args:
        max_requests: Maximum requests allowed per minute
        
    Returns:
        Dependency function for FastAPI
    """
    def dependency(request: Request) -> None:
        check_rate_limit(request, max_requests)
    
    return dependency