import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  ProductFormSchema,
  SellerRegistrationSchema,
  SearchFilterSchema,
  CheckoutSchema,
} from "@/lib/validation";

describe("Validation Schemas", () => {
  describe("ProductFormSchema", () => {
    it("validates correct product data", () => {
      const validData = {
        name: "Elegant Dress",
        description: "A beautiful dress for all seasons",
        price: 29.99,
        category: "clothing",
        image: "https://example.com/image.jpg",
        stock: 10,
        sku: "DRESS-001",
      };

      expect(() => ProductFormSchema.parse(validData)).not.toThrow();
    });

    it("rejects invalid product data", () => {
      const invalidData = {
        name: "Dr", // Too short
        description: "Short", // Too short
        price: -5, // Negative
        category: "",
        image: "not-a-url",
        stock: -1,
        sku: "",
      };

      expect(() => ProductFormSchema.parse(invalidData)).toThrow();
    });
  });

  describe("SellerRegistrationSchema", () => {
    it("validates correct seller registration", () => {
      const validData = {
        storeName: "My Beautiful Store",
        email: "seller@example.com",
        password: "SecurePass123!",
        phone: "1234567890",
        businessType: "individual" as const,
        taxId: "12345678901",
        address: "123 Main Street, City, State 12345",
        bankAccount: "1234567890123456",
        acceptTerms: true,
      };

      expect(() => SellerRegistrationSchema.parse(validData)).not.toThrow();
    });

    it("rejects seller data without accepting terms", () => {
      const invalidData = {
        storeName: "Store",
        email: "seller@example.com",
        password: "SecurePass123!",
        phone: "1234567890",
        businessType: "individual" as const,
        taxId: "12345678901",
        address: "123 Main Street, City, State 12345",
        bankAccount: "1234567890123456",
        acceptTerms: false,
      };

      expect(() => SellerRegistrationSchema.parse(invalidData)).toThrow();
    });
  });

  describe("CheckoutSchema", () => {
    it("validates correct checkout data", () => {
      const validData = {
        email: "buyer@example.com",
        firstName: "John",
        lastName: "Doe",
        address: "123 Main Street",
        city: "Springfield",
        zipCode: "12345",
        country: "USA",
        cardName: "John Doe",
        cardNumber: "4111111111111111",
        expiryDate: "12/25",
        cvv: "123",
      };

      expect(() => CheckoutSchema.parse(validData)).not.toThrow();
    });

    it("rejects invalid card number", () => {
      const invalidData = {
        email: "buyer@example.com",
        firstName: "John",
        lastName: "Doe",
        address: "123 Main Street",
        city: "Springfield",
        zipCode: "12345",
        country: "USA",
        cardName: "John Doe",
        cardNumber: "invalid", // Invalid card
        expiryDate: "12/25",
        cvv: "123",
      };

      expect(() => CheckoutSchema.parse(invalidData)).toThrow();
    });
  });
});
