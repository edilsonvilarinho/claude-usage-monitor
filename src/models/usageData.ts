export interface UsageWindow {
  utilization: number; // 0.0 to 100.0 (percentage)
  resets_at: string;   // ISO datetime string
}

export interface ExtraUsage {
  is_enabled: boolean;
  monthly_limit: number; // cents
  used_credits: number;  // cents
}

export interface UsageData {
  five_hour: UsageWindow;
  seven_day: UsageWindow;
  seven_day_sonnet?: UsageWindow;
  sonnet_only?: UsageWindow;
  extra_usage?: ExtraUsage;
}

export interface ProfileData {
  account: {
    display_name: string;
    email: string;
    has_claude_pro: boolean;
    has_claude_max: boolean;
  };
}

export interface CredentialsFile {
  claudeAiOauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Unix milliseconds
    scopes?: string[];
    subscriptionType?: string;
  };
}
