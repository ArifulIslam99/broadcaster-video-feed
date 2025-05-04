import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

const client = new SuiClient({ url: getFullnodeUrl('testnet') });
const PACKAGE_ID = '0x942ea57ff14fcef33b2dbe9cc888d256edad279c4e483e6c31173e722306d639';

function decodeVectorString(bytes: number[]): string[] {
    const strings: string[] = [];
    let i = 0;
    const count = bytes[i++];
    for (let j = 0; j < count; j++) {
      const len = bytes[i++];
      const strBytes = bytes.slice(i, i + len);
      const decodedStr = String.fromCharCode(...strBytes);
      strings.push(decodedStr);
      i += len;
    }
    return strings;
  };

const fetchOnChainFileIds = async (): Promise<string[]> => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::file_storage::get_file_ids`,
    arguments: [
      tx.object("0xbacf4415d279fc240f1de1967eaca4933502ca7803e3cf8295cadad9eca4dacf")
    ],
  });

const result = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: "0xa6ffff483e4908b17f550649b353e6e2bed34f3d575f748d1a0408253c2b9154",
  });

  const rawValues = result.results?.[0]?.returnValues?.[0]?.[0];
  if (!rawValues) return [];
  return decodeVectorString(rawValues);
};

export default fetchOnChainFileIds;