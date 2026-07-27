"use client";

import "react-phone-number-input/style.css";
import PhoneInput, { type Value as PhoneValue } from "react-phone-number-input";

interface PhoneFieldProps {
  value: PhoneValue | undefined;
  onChange: (value: PhoneValue | undefined) => void;
  name?: string;
  required?: boolean;
}

export function PhoneField({ value, onChange, name = "whatsapp", required }: PhoneFieldProps) {
  return (
    <div className="phone-field-wrapper">
      <PhoneInput
        international
        defaultCountry="IN"
        value={value}
        onChange={onChange}
        name={name}
        required={required}
        placeholder="98765 43210"
        // countryCallingCodeEditable={false} keeps the code locked after selection
        countryCallingCodeEditable={false}
        smartCaret
      />
    </div>
  );
}
