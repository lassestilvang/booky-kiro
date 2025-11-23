import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '@bookmark-manager/shared';
import { UserRepository } from '../repositories/user.repository.js';

const BCRYPT_COST_FACTOR = 12;
const JWT_ACCESS_TOKEN_EXPIRY = '15m';
const JWT_REFRESH_TOKEN_EXPIRY = '7d';

export interface RegisterUserData {
  email: string;
  password: string;
  name: string;
  plan?: 'free' | 'pro';
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  plan: 'free' | 'pro';
  type: 'access' | 'refresh';
}

/**
 * Authentication service handling user registration, login, and token management
 */
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtPrivateKey: string,
    private jwtPublicKey: string,
    private jwtRefreshPrivateKey: string,
    private jwtRefreshPublicKey: string
  ) {}

  /**
   * Register a new user with password hashing
   * Implements bcrypt with cost factor 12 as per requirements
   */
  async register(data: RegisterUserData): Promise<User> {
    // Validate email format
    if (!this.isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    if (!this.isValidPassword(data.password)) {
      throw new Error(
        'Password must be at least 8 characters long and contain uppercase, lowercase, and numbers'
      );
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password with bcrypt cost factor 12
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST_FACTOR);

    // Create user
    const user = await this.userRepository.createWithPassword(
      data.email,
      passwordHash,
      data.name,
      data.plan || 'free'
    );

    return user;
  }

  /**
   * Authenticate user and issue JWT tokens
   */
  async login(credentials: LoginCredentials): Promise<TokenPair> {
    // Find user with password hash
    const user = await this.userRepository.findByEmailWithPassword(
      credentials.email
    );

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      credentials.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate token pair
    return this.generateTokenPair(user);
  }

  /**
   * Generate JWT access and refresh tokens using RS256 signing
   */
  private generateTokenPair(user: User): TokenPair {
    const payload: Omit<JWTPayload, 'type'> = {
      userId: user.id,
      email: user.email,
      plan: user.plan,
    };

    const accessToken = jwt.sign(
      { ...payload, type: 'access' },
      this.jwtPrivateKey,
      {
        expiresIn: JWT_ACCESS_TOKEN_EXPIRY,
        algorithm: 'RS256',
      }
    );

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      this.jwtRefreshPrivateKey,
      {
        expiresIn: JWT_REFRESH_TOKEN_EXPIRY,
        algorithm: 'RS256',
      }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const payload = jwt.verify(
        refreshToken,
        this.jwtRefreshPublicKey,
        { algorithms: ['RS256'] }
      ) as JWTPayload;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Get current user data
      const user = await this.userRepository.findById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new access token
      const accessPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        plan: user.plan,
        type: 'access',
      };

      return jwt.sign(accessPayload, this.jwtPrivateKey, {
        expiresIn: JWT_ACCESS_TOKEN_EXPIRY,
        algorithm: 'RS256',
      });
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Verify and decode JWT access token using RS256
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, this.jwtPublicKey, {
        algorithms: ['RS256'],
      }) as JWTPayload;

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  private isValidPassword(password: string): boolean {
    // At least 8 characters, contains uppercase, lowercase, and numbers
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
    );
  }
}
