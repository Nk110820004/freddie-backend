import { google } from "googleapis"
import env from "../config/env"
import { logger } from "../utils/logger"

export interface GMBReview {
  reviewId: string
  reviewer: {
    profilePhotoUrl?: string
    displayName: string
    isAnonymous?: boolean
  }
  starRating: "FIVE" | "FOUR" | "THREE" | "TWO" | "ONE"
  comment?: string
  createTime: string
  updateTime: string
  reviewReply?: {
    comment: string
    updateTime: string
  }
}

export class GoogleMyBusinessService {
  private oauth2Client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI)

  constructor() {
    if (env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
      })
    }
  }

  /**
   * Get OAuth URL for user authorization
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/business.manage",
        "https://www.googleapis.com/auth/plus.business.manage",
      ],
      prompt: "consent",
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<string | null> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code)

      logger.info("Google OAuth tokens received")

      return tokens.refresh_token || null
    } catch (error) {
      logger.error("Failed to exchange OAuth code", error)
      return null
    }
  }

  /**
   * Fetch reviews from a GMB location
   * Returns reviews from last 15 minutes if lastFetchTime provided
   */
  async fetchReviews(locationName: string, lastFetchTime?: Date): Promise<GMBReview[] | null> {
    try {
      if (!env.GOOGLE_REFRESH_TOKEN) {
        logger.warn("Google refresh token not configured")
        return null
      }

      const mybusinessaccountmanagement = google.mybusinessaccountmanagement("v1")
      const mybusiness = google.mybusinessbusinessinformation("v1")

      const response = await mybusiness.locations.reviews.list({
        auth: this.oauth2Client,
        parent: locationName,
        pageSize: 50,
      } as any)

      let reviews: any[] = response.data.reviews || []

      // Filter by time if provided (last 15 minutes)
      if (lastFetchTime) {
        reviews = reviews.filter((review) => {
          const reviewTime = new Date(review.updateTime || review.createTime)
          return reviewTime > lastFetchTime
        })
      }

      const mapped: GMBReview[] = reviews.map((r) => ({
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
      }))

      logger.info(`Fetched ${mapped.length} reviews from GMB`, {
        locationName,
        filtered: lastFetchTime ? "yes" : "no",
      })

      return mapped
    } catch (error) {
      logger.error("Failed to fetch GMB reviews", error)
      return null
    }
  }

  /**
   * Convert star rating enum to number
   */
  ratingToNumber(rating: GMBReview["starRating"]): number {
    const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
    return map[rating] || 0
  }

  /**
   * Post a reply to a review
   */
  async postReply(locationName: string, reviewId: string, replyText: string, refreshToken: string): Promise<boolean> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REDIRECT_URI,
      )
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      })

      const mybusiness = google.mybusinessbusinessinformation("v1")

      await mybusiness.locations.reviews.updateReply({
        auth: oauth2Client,
        name: `${locationName}/reviews/${reviewId}`,
        requestBody: {
          comment: replyText,
        },
      } as any)

      logger.info("Posted reply to GMB review", {
        locationName,
        reviewId,
      })

      return true
    } catch (error) {
      logger.error("Failed to post GMB reply", error)
      return false
    }
  }

  /**
   * List all locations for the account
   */
  async listLocations(refreshToken?: string): Promise<any[] | null> {
    try {
      const token = refreshToken || env.GOOGLE_REFRESH_TOKEN
      if (!token) {
        logger.warn("Google refresh token not configured")
        return null
      }

      const oauth2Client = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REDIRECT_URI,
      )
      oauth2Client.setCredentials({
        refresh_token: token,
      })

      const mybusiness = google.mybusinessbusinessinformation("v1")
      const mybusinessaccountmanagement = google.mybusinessaccountmanagement("v1")

      const accountsResponse = await mybusinessaccountmanagement.accounts.list({
        auth: oauth2Client,
      })

      const accounts = accountsResponse.data.accounts || []

      if (accounts.length === 0) {
        logger.warn("No GMB accounts found")
        return []
      }

      const accountName = accounts[0].name

      const locationsResponse = await mybusiness.accounts.locations.list({
        auth: oauth2Client,
        parent: accountName,
        readMask: "name,title,phoneNumbers,storefrontAddress",
      } as any)

      const locations = locationsResponse.data.locations || []

      logger.info(`Fetched ${locations.length} locations from GMB`)

      return locations
    } catch (error) {
      logger.error("Failed to fetch GMB locations", error)
      return null
    }
  }
}

export const gmbService = new GoogleMyBusinessService()
