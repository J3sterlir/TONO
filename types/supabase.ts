export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ACCOUNT_PREF_GENRE: {
        Row: {
          ACCOUNT_ID: string
          Genre_ID: string
        }
        Insert: {
          ACCOUNT_ID: string
          Genre_ID: string
        }
        Update: {
          ACCOUNT_ID?: string
          Genre_ID?: string
        }
        Relationships: [
          {
            foreignKeyName: "ACCOUNT_PREF_GENRE_ACCOUNT_ID_fkey"
            columns: ["ACCOUNT_ID"]
            isOneToOne: false
            referencedRelation: "USER_ACCOUNT"
            referencedColumns: ["ACCOUNT_ID"]
          },
          {
            foreignKeyName: "ACCOUNT_PREF_GENRE_Genre_ID_fkey"
            columns: ["Genre_ID"]
            isOneToOne: false
            referencedRelation: "TAG_GENRE"
            referencedColumns: ["Genre_ID"]
          },
        ]
      }
      ACCOUNT_PREF_INSTRUMENTS: {
        Row: {
          ACCOUNT_ID: string
          Instrument_ID: string
        }
        Insert: {
          ACCOUNT_ID: string
          Instrument_ID: string
        }
        Update: {
          ACCOUNT_ID?: string
          Instrument_ID?: string
        }
        Relationships: [
          {
            foreignKeyName: "ACCOUNT_PREF_INSTRUMENTS_ACCOUNT_ID_fkey"
            columns: ["ACCOUNT_ID"]
            isOneToOne: false
            referencedRelation: "USER_ACCOUNT"
            referencedColumns: ["ACCOUNT_ID"]
          },
          {
            foreignKeyName: "ACCOUNT_PREF_INSTRUMENTS_Instrument_ID_fkey"
            columns: ["Instrument_ID"]
            isOneToOne: false
            referencedRelation: "TAG_INSTRUMENT"
            referencedColumns: ["Instrument_ID"]
          },
        ]
      }
      ADMIN: {
        Row: {
          ADMIN_ID: string
          Created_at: string | null
          Email: string
          Username: string
        }
        Insert: {
          ADMIN_ID?: string
          Created_at?: string | null
          Email: string
          Username: string
        }
        Update: {
          ADMIN_ID?: string
          Created_at?: string | null
          Email?: string
          Username?: string
        }
        Relationships: []
      }
      ARTIST: {
        Row: {
          ACCOUNT_ID: string | null
          ARTIST_ID: string
          Artist_Type: Database["public"]["Enums"]["artist_type_enum"]
          Bio: string | null
          Created_at: string | null
          Is_Verified: boolean | null
          Links: Json | null
          Status: string
        }
        Insert: {
          ACCOUNT_ID?: string | null
          ARTIST_ID?: string
          Artist_Type: Database["public"]["Enums"]["artist_type_enum"]
          Bio?: string | null
          Created_at?: string | null
          Is_Verified?: boolean | null
          Links?: Json | null
          Status?: string
        }
        Update: {
          ACCOUNT_ID?: string | null
          ARTIST_ID?: string
          Artist_Type?: Database["public"]["Enums"]["artist_type_enum"]
          Bio?: string | null
          Created_at?: string | null
          Is_Verified?: boolean | null
          Links?: Json | null
          Status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ARTIST_ACCOUNT_ID_fkey"
            columns: ["ACCOUNT_ID"]
            isOneToOne: false
            referencedRelation: "USER_ACCOUNT"
            referencedColumns: ["ACCOUNT_ID"]
          },
        ]
      }
      BAND: {
        Row: {
          ARTIST_ID: string
          Band_Name: string
          Formation_Date: string | null
        }
        Insert: {
          ARTIST_ID: string
          Band_Name: string
          Formation_Date?: string | null
        }
        Update: {
          ARTIST_ID?: string
          Band_Name?: string
          Formation_Date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "BAND_ARTIST_ID_fkey"
            columns: ["ARTIST_ID"]
            isOneToOne: true
            referencedRelation: "ARTIST"
            referencedColumns: ["ARTIST_ID"]
          },
        ]
      }
      BAND_GENRES: {
        Row: {
          ARTIST_ID: string
          Genre_ID: string
        }
        Insert: {
          ARTIST_ID: string
          Genre_ID: string
        }
        Update: {
          ARTIST_ID?: string
          Genre_ID?: string
        }
        Relationships: [
          {
            foreignKeyName: "BAND_GENRES_ARTIST_ID_fkey"
            columns: ["ARTIST_ID"]
            isOneToOne: false
            referencedRelation: "BAND"
            referencedColumns: ["ARTIST_ID"]
          },
          {
            foreignKeyName: "BAND_GENRES_Genre_ID_fkey"
            columns: ["Genre_ID"]
            isOneToOne: false
            referencedRelation: "TAG_GENRE"
            referencedColumns: ["Genre_ID"]
          },
        ]
      }
      BUSINESS_PROFILE: {
        Row: {
          ACCOUNT_ID: string | null
          Business_Address: string | null
          BUSINESS_ID: string
          Business_Name: string
          Business_Service: string | null
          Contact_Information: string | null
          Profile_Picture: string | null
        }
        Insert: {
          ACCOUNT_ID?: string | null
          Business_Address?: string | null
          BUSINESS_ID?: string
          Business_Name: string
          Business_Service?: string | null
          Contact_Information?: string | null
          Profile_Picture?: string | null
        }
        Update: {
          ACCOUNT_ID?: string | null
          Business_Address?: string | null
          BUSINESS_ID?: string
          Business_Name?: string
          Business_Service?: string | null
          Contact_Information?: string | null
          Profile_Picture?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "BUSINESS_PROFILE_ACCOUNT_ID_fkey"
            columns: ["ACCOUNT_ID"]
            isOneToOne: false
            referencedRelation: "USER_ACCOUNT"
            referencedColumns: ["ACCOUNT_ID"]
          },
        ]
      }
      SOLO_ARTIST: {
        Row: {
          ARTIST_ID: string
          Artist_Name: string
          Specialty: string
        }
        Insert: {
          ARTIST_ID: string
          Artist_Name: string
          Specialty: string
        }
        Update: {
          ARTIST_ID?: string
          Artist_Name?: string
          Specialty?: string
        }
        Relationships: [
          {
            foreignKeyName: "SOLO_ARTIST_ARTIST_ID_fkey"
            columns: ["ARTIST_ID"]
            isOneToOne: true
            referencedRelation: "ARTIST"
            referencedColumns: ["ARTIST_ID"]
          },
        ]
      }
      SOLO_GENRES: {
        Row: {
          ARTIST_ID: string
          Genre_ID: string
        }
        Insert: {
          ARTIST_ID: string
          Genre_ID: string
        }
        Update: {
          ARTIST_ID?: string
          Genre_ID?: string
        }
        Relationships: [
          {
            foreignKeyName: "SOLO_GENRES_ARTIST_ID_fkey"
            columns: ["ARTIST_ID"]
            isOneToOne: false
            referencedRelation: "SOLO_ARTIST"
            referencedColumns: ["ARTIST_ID"]
          },
          {
            foreignKeyName: "SOLO_GENRES_Genre_ID_fkey"
            columns: ["Genre_ID"]
            isOneToOne: false
            referencedRelation: "TAG_GENRE"
            referencedColumns: ["Genre_ID"]
          },
        ]
      }
      SOLO_INSTRUMENTS: {
        Row: {
          ARTIST_ID: string
          Instrument_ID: string
        }
        Insert: {
          ARTIST_ID: string
          Instrument_ID: string
        }
        Update: {
          ARTIST_ID?: string
          Instrument_ID?: string
        }
        Relationships: [
          {
            foreignKeyName: "SOLO_INSTRUMENTS_ARTIST_ID_fkey"
            columns: ["ARTIST_ID"]
            isOneToOne: false
            referencedRelation: "SOLO_ARTIST"
            referencedColumns: ["ARTIST_ID"]
          },
          {
            foreignKeyName: "SOLO_INSTRUMENTS_Instrument_ID_fkey"
            columns: ["Instrument_ID"]
            isOneToOne: false
            referencedRelation: "TAG_INSTRUMENT"
            referencedColumns: ["Instrument_ID"]
          },
        ]
      }
      TAG_GENRE: {
        Row: {
          Genre_ID: string
          Is_active: boolean | null
          Name: string
        }
        Insert: {
          Genre_ID?: string
          Is_active?: boolean | null
          Name: string
        }
        Update: {
          Genre_ID?: string
          Is_active?: boolean | null
          Name?: string
        }
        Relationships: []
      }
      TAG_INSTRUMENT: {
        Row: {
          Instrument_ID: string
          Is_active: boolean | null
          Name: string
        }
        Insert: {
          Instrument_ID?: string
          Is_active?: boolean | null
          Name: string
        }
        Update: {
          Instrument_ID?: string
          Is_active?: boolean | null
          Name?: string
        }
        Relationships: []
      }
      USER_ACCOUNT: {
        Row: {
          ACCOUNT_ID: string
          Barangay: string | null
          City: string | null
          Cover_Picture: string | null
          Created_at: string | null
          Email: string
          Profile_Picture: string | null
          Username: string
        }
        Insert: {
          ACCOUNT_ID: string
          Barangay?: string | null
          City?: string | null
          Cover_Picture?: string | null
          Created_at?: string | null
          Email: string
          Profile_Picture?: string | null
          Username: string
        }
        Update: {
          ACCOUNT_ID?: string
          Barangay?: string | null
          City?: string | null
          Cover_Picture?: string | null
          Created_at?: string | null
          Email?: string
          Profile_Picture?: string | null
          Username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_email_by_username: { Args: { p_username: string }; Returns: string }
    }
    Enums: {
      artist_type_enum: "Solo" | "Band"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      artist_type_enum: ["Solo", "Band"],
    },
  },
} as const
