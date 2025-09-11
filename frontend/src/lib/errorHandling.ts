import toast from "react-hot-toast";

// Error retry logic for API calls
export const shouldRetry = (error: any): boolean => {
  // Don't retry on 4xx client errors (except 408, 429)
  if (error?.response?.status >= 400 && error?.response?.status < 500) {
    return error?.response?.status === 408 || error?.response?.status === 429;
  }

  // Retry on 5xx server errors and network errors
  return error?.response?.status >= 500 || !error?.response;
};

// Success toast with consistent styling
export const showSuccessToast = (message: string) => {
  toast.success(message, {
    style: {
      background: '#1e293b',
      color: '#f1f5f9',
      border: '1px solid #10b981',
    },
    iconTheme: {
      primary: '#10b981',
      secondary: '#1e293b',
    },
  });
};

// Error toast with consistent styling
export const showErrorToast = (error: any, fallbackMessage?: string) => {
  const message = error?.response?.data?.message ||
                  error?.message ||
                  fallbackMessage ||
                  'An error occurred';

  toast.error(message, {
    style: {
      background: '#1e293b',
      color: '#f1f5f9',
      border: '1px solid #ef4444',
    },
    iconTheme: {
      primary: '#ef4444',
      secondary: '#1e293b',
    },
  });
};
