import { google } from "googleapis";
import env from "../config/env";
import { logger } from "../utils/logger";

export interface GMBReview {
  reviewId: string;          // short id (last part)
  reviewName?: string;       // full resource name: accounts/.../locations/.../reviews/...
  locationName?: string;     // accounts/.../locations/...

  reviewer: {
    profilePhotoUrl?: string;
    displayName: string;
    isAnonymous?: boolean;
  };

  starRating: "FIVE" | "FOUR" | "THREE" | "TWO" | "ONE";
  comment?: string;
  createTime: string;
  updateTime: string;

  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export class GoogleMyBusinessService {
  private oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );

  constructor() {
    if (env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
      });
    }
  }

  /**
   * Create OAuth2 client for specific refresh token
   */
  private createOAuth2Client(refreshToken: string): any {
    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    return oauth2Client;
  }

  /**
   * Get OAuth URL for user authorization
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/business.manage",
        // plus.business.manage is legacy but ok to keep
        "https://www.googleapis.com/auth/plus.business.manage",
      ],
      prompt: "consent",
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<string | null> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      logger.info("Google OAuth tokens received");

      return tokens.refresh_token || null;
    } catch (error) {
      logger.error("Failed to exchange OAuth code", error);
      return null;
    }
  }

  /**
   * Get OAuth URL with state parameter for outlet-specific connection
   */
  getAuthUrlWithState(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/business.manage",
        "https://www.googleapis.com/auth/plus.business.manage",
      ],
      state,
    });
  }

  /**
   * Fetch locations for a specific outlet using its refresh token
   */
  async fetchLocationsForOutlet(refreshToken: string): Promise<any[] | null> {
    try {
      const oauth2Client = this.createOAuth2Client(refreshToken);

      // ✅ Correct way to refresh/ensure access token
      await oauth2Client.getAccessToken();

      const mybusiness = google.mybusinessbusinessinformation("v1");
      const mybusinessaccountmanagement = google.mybusinessaccountmanagement("v1");

      const accountsResponse = await mybusinessaccountmanagement.accounts.list({
        auth: oauth2Client,
      });

      const accounts = accountsResponse.data.accounts || [];
      if (accounts.length === 0) {
        logger.warn("No GMB accounts found");
        return [];
      }

      const accountName = accounts[0].name;

      const locationsResponse = await mybusiness.accounts.locations.list({
        auth: oauth2Client,
        parent: accountName,
        readMask: "name,title,phoneNumbers,storefrontAddress,metadata",
      } as any);

      const locations = locationsResponse.data.locations || [];

      logger.info(`Fetched ${locations.length} locations from GMB for outlet`);
      return locations;
    } catch (error) {
      logger.error("Failed to fetch GMB locations for outlet", error);
      return null;
    }
  }

  /**
   * Fetch reviews from a GMB location with pagination.
   * If lastFetchTime is provided, returns only recently updated/created reviews.
   */
  async fetchReviews(
    locationName: string,
    refreshToken: string,
    lastFetchTime?: Date
  ): Promise<GMBReview[] | null> {
    try {
      if (!refreshToken) {
        logger.warn("Google refresh token not provided for fetchReviews");
        return null;
      }

      const oauth2Client = this.createOAuth2Client(refreshToken);
      const mybusiness = (google as any).mybusiness?.("v4") as any;

      let allReviews: any[] = [];
      let pageToken: string | undefined = undefined;
      let pageCount = 0;
      const MAX_PAGES = 5;

      do {
        const response: any = await mybusiness.locations.reviews.list({
          auth: oauth2Client,
          parent: locationName,
          pageSize: 50,
          pageToken,
        } as any);

        const reviews = response.data.reviews || [];
        allReviews = allReviews.concat(reviews);

        pageToken = response.data.nextPageToken;
        pageCount++;

        if (pageCount >= MAX_PAGES && pageToken) {
          logger.warn(`Pagination limit reached (${MAX_PAGES} pages) - stopping fetch`);
          break;
        }
      } while (pageToken);

      if (lastFetchTime) {
        allReviews = allReviews.filter((review) => {
          const reviewTime = new Date(review.updateTime || review.createTime);
          return reviewTime > lastFetchTime;
        });
      }

      const mapped: GMBReview[] = allReviews.map((r) => ({
        // ✅ Short id for DB idempotency if needed
        reviewId: r.name?.split("/").pop() || "",

        // ✅ Full resource name (most reliable for replying)
        reviewName: r.name,

        locationName,

        reviewer: {
          displayName: r.reviewer?.displayName || "Anonymous",
          profilePhotoUrl: r.reviewer?.profilePhotoUrl,
          isAnonymous: r.reviewer?.isAnonymous || false,
        },

        starRating: r.starRating,
        comment: r.comment || "",
        createTime: r.createTime,
        updateTime: r.updateTime,
        reviewReply: r.reviewReply,
      }));

      logger.info(`Fetched ${mapped.length} reviews from GMB (${pageCount} pages)`, {
        locationName,
        filtered: lastFetchTime ? "yes" : "no",
      });

      return mapped;
    } catch (error: any) {
      if (error.status === 401) {
        logger.error("GMB: Unauthorized - refresh token may be invalid", error.message);
      } else if (error.status === 403) {
        logger.error("GMB: Forbidden - check permissions", error.message);
      } else if (error.status === 429) {
        logger.error("GMB: Rate limited", error.message);
      } else if (error.status === 503) {
        logger.error("GMB: Service unavailable", error.message);
      } else {
        logger.error("Failed to fetch GMB reviews", error);
      }
      return null;
    }
  }

  /**
   * Convert star rating enum to number
   */
  ratingToNumber(rating: GMBReview["starRating"]): number {
    const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 } as const;
    return map[rating] || 0;
  }

  /**
   * Post a reply to a review
   *
   * ✅ Uses proper review resource name.
   */
  async postReply(
    locationName: string,
    reviewId: string,
    replyText: string,
    refreshToken: string
  ): Promise<boolean> {
    try {
      const oauth2Client = this.createOAuth2Client(refreshToken);
      const mybusiness = (google as any).mybusiness?.("v4") as any;

      // review resource name
      const reviewName = `${locationName}/reviews/${reviewId}`;

      await mybusiness.locations.reviews.updateReply({
        auth: oauth2Client,
        name: reviewName,
        requestBody: { comment: replyText },
      } as any);

      logger.info("Posted reply to GMB review", { locationName, reviewId });
      return true;
    } catch (error) {
      logger.error("Failed to post GMB reply", error);
      return false;
    }
  }

  /**
   * List all locations for the account
   */
  async listLocations(refreshToken?: string): Promise<any[] | null> {
    try {
      const token = refreshToken || env.GOOGLE_REFRESH_TOKEN;
      if (!token) {
        logger.warn("Google refresh token not configured");
        return null;
      }

      const oauth2Client = this.createOAuth2Client(token);

      const mybusiness = google.mybusinessbusinessinformation("v1");
      const mybusinessaccountmanagement = google.mybusinessaccountmanagement("v1");

      const accountsResponse = await mybusinessaccountmanagement.accounts.list({
        auth: oauth2Client,
      });

      const accounts = accountsResponse.data.accounts || [];
      if (accounts.length === 0) {
        logger.warn("No GMB accounts found");
        return [];
      }

      const accountName = accounts[0].name;

      const locationsResponse = await mybusiness.accounts.locations.list({
        auth: oauth2Client,
        parent: accountName,
        readMask: "name,title,phoneNumbers,storefrontAddress",
      } as any);

      const locations = locationsResponse.data.locations || [];

      logger.info(`Fetched ${locations.length} locations from GMB`);
      return locations;
    } catch (error) {
      logger.error("Failed to fetch GMB locations", error);
      return null;
    }
  }
}

export const gmbService = new GoogleMyBusinessService();
