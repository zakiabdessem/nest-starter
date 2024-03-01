function cookieConfig() {
    return {
      httpOnly: true,
      sameSite: 'strict' as const, // TypeScript may require the "as const" assertion for string literals
      secure: process.env.NODE_ENV === 'production', // secure cookies should only be set in production
      domain: process.env.NODE_ENV === 'production' ? `.${process.env.COOKIE_URL}` : 'localhost', // use 'localhost' as domain in development
    };
  }
  
  export default cookieConfig;