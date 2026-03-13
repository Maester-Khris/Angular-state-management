import { AppUser, GoogleUser } from "./user.model";

export class UserAdapter {
    /** Map MongoDB Response to AppUser */
    static fromMongo(mongo: any): AppUser {
        return {
            uuid: mongo.useruuid,
            name: mongo.name,
            email: mongo.email,
            avatarUrl: mongo.avatarUrl,
            bio: mongo.bio,
            status: mongo.status,
            isVerified: mongo.isVerified,
            source: 'internal'
        };
    }

    /** Map Google Auth Response to AppUser */
    static fromGoogle(google: GoogleUser, internalId: string): AppUser {
        return {
            uuid: internalId, // This should come from your backend after "stitching"
            name: google.name,
            email: google.email,
            avatarUrl: google.picture,
            status: 'active',
            isVerified: true, // Google accounts are implicitly verified
            source: 'google'
        };
    }
}
