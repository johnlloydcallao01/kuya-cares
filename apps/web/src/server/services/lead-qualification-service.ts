/**
 * @file apps/web/src/server/services/lead-qualification-service.ts
 * @description Lead qualification and scoring service for the web app
 */

import 'server-only';
import type { ContactFormData } from '../validators/contact-schemas';

// ========================================
// LEAD QUALIFICATION TYPES
// ========================================

export type LeadScore = {
  score: number; // 0-100
  quality: 'cold' | 'warm' | 'hot' | 'qualified';
  reasons: string[];
  nextAction: 'nurture' | 'contact' | 'demo' | 'quote';
  priority: 'low' | 'medium' | 'high' | 'urgent';
};

export type LeadQualificationCriteria = {
  companySize?: 'startup' | 'small' | 'medium' | 'enterprise';
  industry?: string;
  budget?: 'low' | 'medium' | 'high' | 'enterprise';
  timeline?: 'immediate' | 'short' | 'medium' | 'long';
  authority?: 'user' | 'influencer' | 'decision_maker' | 'champion';
};

// ========================================
// LEAD QUALIFICATION SERVICE
// ========================================

export class LeadQualificationService {
  /**
   * Qualify a lead based on contact form data
   */
  static async qualifyLead(contactData: ContactFormData): Promise<LeadScore> {
    let score = 0;
    const reasons: string[] = [];
    
    // Company analysis
    if (contactData.company) {
      score += 15;
      reasons.push('Provided company information');
      
      // Company size indicators
      if (this.isEnterpriseCompany(contactData.company)) {
        score += 25;
        reasons.push('Enterprise company detected');
      } else if (this.isMediumCompany(contactData.company)) {
        score += 15;
        reasons.push('Medium-sized company detected');
      }
    }
    
    // Email domain analysis
    const emailDomain = contactData.email.split('@')[1];
    if (emailDomain && !this.isGenericEmailDomain(emailDomain)) {
      score += 20;
      reasons.push('Business email domain');
    }
    
    // Message content analysis
    const messageScore = this.analyzeMessageContent(contactData.message);
    score += messageScore.score;
    reasons.push(...messageScore.reasons);
    
    // Subject analysis
    const subjectScore = this.analyzeSubject(contactData.subject);
    score += subjectScore.score;
    reasons.push(...subjectScore.reasons);
    
    // Phone number provided
    if (contactData.phone) {
      score += 10;
      reasons.push('Contact phone provided');
    }
    
    // Determine quality and next action
    const quality = this.determineLeadQuality(score);
    const nextAction = this.determineNextAction(score, contactData);
    const priority = this.determinePriority(score, contactData);
    
    return {
      score: Math.min(score, 100),
      quality,
      reasons,
      nextAction,
      priority,
    };
  }
  
  /**
   * Analyze message content for buying signals
   */
  private static analyzeMessageContent(message: string): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const lowerMessage = message.toLowerCase();
    
    // Buying intent keywords
    const buyingKeywords = [
      'quote', 'pricing', 'cost', 'budget', 'proposal',
      'demo', 'trial', 'purchase', 'buy', 'hire',
      'project', 'need help', 'looking for', 'interested in'
    ];
    
    const urgencyKeywords = [
      'urgent', 'asap', 'immediately', 'soon', 'quickly',
      'deadline', 'launch', 'go live'
    ];
    
    const enterpriseKeywords = [
      'enterprise', 'scale', 'team', 'department',
      'organization', 'company-wide', 'multiple'
    ];
    
    // Check for buying intent
    const buyingMatches = buyingKeywords.filter(keyword => 
      lowerMessage.includes(keyword)
    );
    if (buyingMatches.length > 0) {
      score += buyingMatches.length * 5;
      reasons.push(`Buying intent detected: ${buyingMatches.join(', ')}`);
    }
    
    // Check for urgency
    const urgencyMatches = urgencyKeywords.filter(keyword => 
      lowerMessage.includes(keyword)
    );
    if (urgencyMatches.length > 0) {
      score += urgencyMatches.length * 8;
      reasons.push(`Urgency indicators: ${urgencyMatches.join(', ')}`);
    }
    
    // Check for enterprise indicators
    const enterpriseMatches = enterpriseKeywords.filter(keyword => 
      lowerMessage.includes(keyword)
    );
    if (enterpriseMatches.length > 0) {
      score += enterpriseMatches.length * 6;
      reasons.push(`Enterprise indicators: ${enterpriseMatches.join(', ')}`);
    }
    
    // Message length analysis
    if (message.length > 200) {
      score += 5;
      reasons.push('Detailed message provided');
    }
    
    return { score, reasons };
  }
  
  /**
   * Analyze subject line for intent
   */
  private static analyzeSubject(subject: string): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const lowerSubject = subject.toLowerCase();
    
    const highValueSubjects = [
      'partnership', 'collaboration', 'enterprise',
      'bulk', 'volume', 'contract', 'agreement'
    ];
    
    const serviceSubjects = [
      'marketing', 'ecommerce', 'seo', 'advertising',
      'campaign', 'strategy', 'consulting'
    ];
    
    // High-value subject indicators
    const highValueMatches = highValueSubjects.filter(keyword => 
      lowerSubject.includes(keyword)
    );
    if (highValueMatches.length > 0) {
      score += 15;
      reasons.push(`High-value subject: ${highValueMatches.join(', ')}`);
    }
    
    // Service-related subjects
    const serviceMatches = serviceSubjects.filter(keyword => 
      lowerSubject.includes(keyword)
    );
    if (serviceMatches.length > 0) {
      score += 10;
      reasons.push(`Service-related inquiry: ${serviceMatches.join(', ')}`);
    }
    
    return { score, reasons };
  }
  
  /**
   * Check if company appears to be enterprise-level
   */
  private static isEnterpriseCompany(company: string): boolean {
    const enterpriseIndicators = [
      'inc', 'corp', 'corporation', 'ltd', 'limited',
      'group', 'holdings', 'enterprises', 'international'
    ];
    
    const lowerCompany = company.toLowerCase();
    return enterpriseIndicators.some(indicator => 
      lowerCompany.includes(indicator)
    );
  }
  
  /**
   * Check if company appears to be medium-sized
   */
  private static isMediumCompany(company: string): boolean {
    const mediumIndicators = [
      'llc', 'studio', 'agency', 'consulting', 'solutions',
      'services', 'technologies', 'digital'
    ];
    
    const lowerCompany = company.toLowerCase();
    return mediumIndicators.some(indicator => 
      lowerCompany.includes(indicator)
    );
  }
  
  /**
   * Check if email domain is generic (Gmail, Yahoo, etc.)
   */
  private static isGenericEmailDomain(domain: string): boolean {
    const genericDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'aol.com', 'icloud.com', 'protonmail.com', 'mail.com'
    ];
    
    return genericDomains.includes(domain.toLowerCase());
  }
  
  /**
   * Determine lead quality based on score
   */
  private static determineLeadQuality(score: number): LeadScore['quality'] {
    if (score >= 80) return 'qualified';
    if (score >= 60) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  }
  
  /**
   * Determine next action based on score and data
   */
  private static determineNextAction(score: number, _data: ContactFormData): LeadScore['nextAction'] {
    if (score >= 80) return 'demo';
    if (score >= 60) return 'contact';
    if (score >= 40) return 'quote';
    return 'nurture';
  }
  
  /**
   * Determine priority based on score and urgency
   */
  private static determinePriority(score: number, data: ContactFormData): LeadScore['priority'] {
    const hasUrgency = data.message.toLowerCase().includes('urgent') || 
                      data.message.toLowerCase().includes('asap');
    
    if (score >= 80 || hasUrgency) return 'urgent';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
}
