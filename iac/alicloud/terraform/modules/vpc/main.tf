# VPC 网络模块
# 职责: 创建 VPC + VSwitch + NAT 网关 + EIP + SNAT
# 参考实现: demo-ask/main.tf (第 49-169 行)

resource "alicloud_vpc" "main" {
  vpc_name   = "${var.project_name}-vpc"
  cidr_block = var.vpc_cidr
  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

resource "alicloud_vswitch" "main" {
  count        = length(var.zone_ids)
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = var.vswitch_cidrs[count.index]
  zone_id      = var.zone_ids[count.index]
  vswitch_name = "${var.project_name}-vswitch-${count.index + 1}"
  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "alicloud_nat_gateway" "main" {
  vpc_id           = alicloud_vpc.main.id
  nat_gateway_name = "${var.project_name}-nat"
  payment_type     = "PayAsYouGo"
  vswitch_id       = alicloud_vswitch.main[0].id
  nat_type         = "Enhanced"
}

resource "alicloud_eip_address" "main" {
  address_name         = "${var.project_name}-eip"
  isp                  = "BGP"
  internet_charge_type = "PayByTraffic"
  bandwidth            = var.nat_bandwidth
}

resource "alicloud_eip_association" "main" {
  allocation_id = alicloud_eip_address.main.id
  instance_id   = alicloud_nat_gateway.main.id
}

resource "alicloud_snat_entry" "main" {
  snat_table_id     = alicloud_nat_gateway.main.snat_table_ids
  source_vswitch_id = alicloud_vswitch.main[0].id
  snat_ip           = alicloud_eip_address.main.ip_address
}
