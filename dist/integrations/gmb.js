"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gmbService = exports.GoogleMyBusinessService = void 0;
const googleapis_1 = require("googleapis");
const env_1 = __importDefault(require("../config/env"));
const logger_1 = require("../utils/logger");
// Retry configuration with exponential backoff
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
class GoogleMyBusinessService {
    constructor() {
        this.oauth2Client = new googleapis_1.google.auth.OAuth2(env_1.default.GOOGLE_CLIENT_ID, env_1.default.GOOGLE_CLIENT_SECRET, env_1.default.GOOGLE_REDIRECT_URI);
        if (env_1.default.GOOGLE_REFRESH_TOKEN) {
            this.oauth2Client.setCredentials({
                refresh_token: env_1.default.GOOGLE_REFRESH_TOKEN,
            });
        }
    }
    /**
     * Create OAuth2 client for specific refresh token
     */
    createOAuth2Client(refreshToken) {
        const oauth2Client = new googleapis_1.google.auth.OAuth2(env_1.default.GOOGLE_CLIENT_ID, env_1.default.GOOGLE_CLIENT_SECRET, env_1.default.GOOGLE_REDIRECT_URI);
        oauth2Client.setCredentials({
            refresh_token: refreshToken,
        });
        return oauth2Client;
    }
    /**
     * Refresh OAuth token with retry logic
     */
    async refreshAccessToken(attempt = 0) {
        try {
            logger_1.logger.debug(`Refreshing Google access token (attempt ${attempt + 1})`);
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            this.oauth2Client.setCredentials(credentials);
            logger_1.logger.info("Google access token refreshed successfully");
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to refresh access token (attempt ${attempt + 1})`, error);
            if (attempt < MAX_RETRIES) {
                const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
                logger_1.logger.info(`Retrying token refresh in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return this.refreshAccessToken(attempt + 1);
            }
            return false;
        }
    }
    /**
     * Get OAuth URL for user authorization
     */
    getAuthUrl() {
        return this.oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: [
                "https://www.googleapis.com/auth/business.manage",
                "https://www.googleapis.com/auth/plus.business.manage",
            ],
            prompt: "consent",
        });
    }
    /**
     * Exchange authorization code for tokens
     */
    async exchangeCode(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            logger_1.logger.info("Google OAuth tokens received");
            return tokens.refresh_token || null;
        }
        catch (error) {
            logger_1.logger.error("Failed to exchange OAuth code", error);
            return null;
        }
    }
    /**
     * Get OAuth URL with state parameter for outlet-specific connection
     */
    getAuthUrlWithState(state) {
        return this.oauth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: [
                "https://www.googleapis.com/auth/business.manage",
                "https://www.googleapis.com/auth/plus.business.manage",
            ],
            state
        });
    }
    /**
     * Fetch locations for a specific outlet using its refresh token
     */
    async fetchLocationsForOutlet(refreshToken) {
        try {
            const oauth2Client = this.createOAuth2Client(refreshToken);
            // Refresh access token
            await oauth2Client.refreshAccessToken();
            const mybusiness = googleapis_1.google.mybusinessbusinessinformation("v1");
            const mybusinessaccountmanagement = googleapis_1.google.mybusinessaccountmanagement("v1");
            const accountsResponse = await mybusinessaccountmanagement.accounts.list({
                auth: oauth2Client,
            });
            const accounts = accountsResponse.data.accounts || [];
            if (accounts.length === 0) {
                logger_1.logger.warn("No GMB accounts found");
                return [];
            }
            const accountName = accounts[0].name;
            const locationsResponse = await mybusiness.accounts.locations.list({
                auth: oauth2Client,
                parent: accountName,
                readMask: "name,title,phoneNumbers,storefrontAddress,metadata",
            });
            const locations = locationsResponse.data.locations || [];
            logger_1.logger.info(`Fetched ${locations.length} locations from GMB for outlet`);
            return locations;
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch GMB locations for outlet", error);
            return null;
        }
    }
    /**
     * Fetch reviews from a GMB location with retry and pagination
     * Returns reviews from last 15 minutes if lastFetchTime provided
     */
    async fetchReviews(locationName, lastFetchTime) {
        try {
            if (!env_1.default.GOOGLE_REFRESH_TOKEN) {
                logger_1.logger.warn("Google refresh token not configured");
                return null;
            }
            // Ensure token is fresh before fetching
            const tokenRefreshed = await this.refreshAccessToken();
            if (!tokenRefreshed) {
                logger_1.logger.error("Could not refresh access token for GMB API");
                return null;
            }
            const mybusiness = googleapis_1.google.mybusiness?.("v4");
            let allReviews = [];
            let pageToken = undefined;
            let pageCount = 0;
            const MAX_PAGES = 5; // Limit pagination to prevent excessive API calls
            // Paginate through all reviews
            do {
                try {
                    const response = await mybusiness.locations.reviews.list({
                        auth: this.oauth2Client,
                        parent: locationName,
                        pageSize: 50,
                        pageToken,
                    });
                    const reviews = response.data.reviews || [];
                    allReviews = allReviews.concat(reviews);
                    pageToken = response.data.nextPageToken;
                    pageCount++;
                    logger_1.logger.debug(`Fetched page ${pageCount} with ${reviews.length} reviews`);
                    if (pageCount >= MAX_PAGES && pageToken) {
                        logger_1.logger.warn(`Pagination limit reached (${MAX_PAGES} pages) - stopping fetch`);
                        break;
                    }
                }
                catch (pageError) {
                    logger_1.logger.error(`Error fetching page ${pageCount + 1}`, pageError);
                    if (pageError.status === 401) {
                        logger_1.logger.warn("Token expired, refresh failed");
                        return null;
                    }
                    break; // Stop pagination on error
                }
            } while (pageToken);
            // Filter by time if provided (last 15 minutes)
            if (lastFetchTime) {
                allReviews = allReviews.filter((review) => {
                    const reviewTime = new Date(review.updateTime || review.createTime);
                    return reviewTime > lastFetchTime;
                });
            }
            const mapped = allReviews.map((r) => ({
                reviewId: r.name?.split("/").pop() || "",
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
            logger_1.logger.info(`Fetched ${mapped.length} reviews from GMB (${pageCount} pages)`, {
                locationName,
                filtered: lastFetchTime ? "yes" : "no",
            });
            return mapped;
        }
        catch (error) {
            // Map Google API errors to actionable messages
            if (error.status === 401) {
                logger_1.logger.error("GMB: Unauthorized - refresh token may be invalid", error.message);
            }
            else if (error.status === 403) {
                logger_1.logger.error("GMB: Forbidden - check permissions", error.message);
            }
            else if (error.status === 429) {
                logger_1.logger.error("GMB: Rate limited - backing off", error.message);
            }
            else if (error.status === 503) {
                logger_1.logger.error("GMB: Service unavailable - will retry next cycle", error.message);
            }
            else {
                logger_1.logger.error("Failed to fetch GMB reviews", error);
            }
            return null;
        }
    }
    /**
     * Convert star rating enum to number
     */
    ratingToNumber(rating) {
        const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
        return map[rating] || 0;
    }
    /**
     * Post a reply to a review
     */
    async postReply(locationName, reviewId, replyText, refreshToken) {
        try {
            const oauth2Client = new googleapis_1.google.auth.OAuth2(env_1.default.GOOGLE_CLIENT_ID, env_1.default.GOOGLE_CLIENT_SECRET, env_1.default.GOOGLE_REDIRECT_URI);
            oauth2Client.setCredentials({
                refresh_token: refreshToken,
            });
            const mybusiness = googleapis_1.google.mybusiness?.("v4");
            await mybusiness.locations.reviews.updateReply({
                auth: oauth2Client,
                name: `${locationName}/reviews/${reviewId}`,
                requestBody: {
                    comment: replyText,
                },
            });
            logger_1.logger.info("Posted reply to GMB review", {
                locationName,
                reviewId,
            });
            return true;
        }
        catch (error) {
            logger_1.logger.error("Failed to post GMB reply", error);
            return false;
        }
    }
    /**
     * List all locations for the account
     */
    async listLocations(refreshToken) {
        try {
            const token = refreshToken || env_1.default.GOOGLE_REFRESH_TOKEN;
            if (!token) {
                logger_1.logger.warn("Google refresh token not configured");
                return null;
            }
            const oauth2Client = new googleapis_1.google.auth.OAuth2(env_1.default.GOOGLE_CLIENT_ID, env_1.default.GOOGLE_CLIENT_SECRET, env_1.default.GOOGLE_REDIRECT_URI);
            oauth2Client.setCredentials({
                refresh_token: token,
            });
            const mybusiness = googleapis_1.google.mybusinessbusinessinformation("v1");
            const mybusinessaccountmanagement = googleapis_1.google.mybusinessaccountmanagement("v1");
            const accountsResponse = await mybusinessaccountmanagement.accounts.list({
                auth: oauth2Client,
            });
            const accounts = accountsResponse.data.accounts || [];
            if (accounts.length === 0) {
                logger_1.logger.warn("No GMB accounts found");
                return [];
            }
            const accountName = accounts[0].name;
            const locationsResponse = await mybusiness.accounts.locations.list({
                auth: oauth2Client,
                parent: accountName,
                readMask: "name,title,phoneNumbers,storefrontAddress",
            });
            const locations = locationsResponse.data.locations || [];
            logger_1.logger.info(`Fetched ${locations.length} locations from GMB`);
            return locations;
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch GMB locations", error);
            return null;
        }
    }
}
exports.GoogleMyBusinessService = GoogleMyBusinessService;
exports.gmbService = new GoogleMyBusinessService();
//# sourceMappingURL=gmb.js.map