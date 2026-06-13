import NextAuth from "next-auth"
import GithubProvider from "next-auth/providers/github"

const handler = NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID || 'mock_client_id',
      clientSecret: process.env.GITHUB_SECRET || 'mock_client_secret',
      authorization: {
        params: {
          // Request permissions to read public repos and workflow files
          scope: 'read:user user:email repo workflow',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token, user }) {
      // Send properties to the client, like an access_token from a provider.
      (session as any).accessToken = token.accessToken
      return session
    }
  }
})

export { handler as GET, handler as POST }
