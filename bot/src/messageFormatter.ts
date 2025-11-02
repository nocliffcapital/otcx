import { formatUnits } from 'viem';
import { config } from './config';

export class MessageFormatter {
  static formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  static formatAmount(amount: bigint, decimals: number = 18): string {
    return parseFloat(formatUnits(amount, decimals)).toLocaleString('en-US', {
      maximumFractionDigits: decimals > 6 ? 2 : 6,
    });
  }

  static formatTimestamp(timestamp: bigint): string {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }

  static createLink(text: string, url: string): string {
    return `[${text}](${url})`;
  }

  static formatProjectAdded(projectId: string, name: string, metadataURI: string): string {
    return `✨ *New Market Added*

📦 *${name}*
🆔 Project ID: \`${this.formatAddress(projectId)}\`
🔗 Metadata: ${metadataURI ? this.createLink('View', metadataURI) : 'N/A'}

${this.createLink('View on Explorer', `${config.explorer.url}/address/${config.contracts.registry}`)}`;
  }

  static formatProjectStatusChanged(projectId: string, active: boolean): string {
    const status = active ? '✅ Activated' : '⏸️ Deactivated';
    return `${status} *Project Status Changed*

🆔 Project ID: \`${this.formatAddress(projectId)}\`
Status: ${active ? 'Active' : 'Inactive'}`;
  }

  static formatTGEActivated(
    projectId: string,
    tokenAddress: string,
    deadline: bigint,
    conversionRatio: bigint
  ): string {
    const deadlineDate = this.formatTimestamp(deadline);
    const isPoints = tokenAddress === '0x0000000000000000000000000000000000000000';
    
    return `🚀 *TGE Activated*

📦 Project: \`${this.formatAddress(projectId)}\`
${isPoints ? '🎯 Type: Points' : `🪙 Token: \`${this.formatAddress(tokenAddress)}\``}
${isPoints && conversionRatio !== BigInt(10 ** 18) ? `📊 Conversion: ${this.formatAmount(conversionRatio)}` : ''}
⏰ Settlement Deadline: ${deadlineDate}

4-hour settlement window is now active! ⏳`;
  }
}
